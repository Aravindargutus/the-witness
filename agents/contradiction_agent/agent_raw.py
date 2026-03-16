"""
contradiction_agent.py
──────────────────────
Background agent that:
1. Polls Firestore for new witness statements every 15 seconds
2. Sends batches to Gemini for semantic contradiction detection
3. Writes contradiction alerts back to Firestore

Run separately alongside your witness sessions:
    python contradiction_agent.py --session SESSION_ID

The React Case Board listens to:
    sessions/{SESSION_ID}/contradictions/{auto-id}
and renders alerts in real time.
"""

import asyncio
import argparse
import os
import json
import sys
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.cloud import firestore

load_dotenv()

MODEL = "gemini-2.5-flash"   # text model — no audio needed here


# ── Load the contradiction engine system prompt ─────────────────────────────

def load_engine_prompt() -> str:
    prompt_path = "prompts/contradiction_engine_prompt.txt"
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"[ERROR] Prompt file not found: {prompt_path}")
        sys.exit(1)


# ── Firestore helpers ────────────────────────────────────────────────────────

def get_all_statements(db: firestore.Client, session_id: str) -> list[dict]:
    """Fetch all witness statements for this session."""
    docs = (
        db.collection("sessions")
        .document(session_id)
        .collection("statements")
        .order_by("created_at")
        .stream()
    )
    statements = []
    for doc in docs:
        data = doc.to_dict()
        statements.append({
            "id":        doc.id,
            "witness":   data.get("witness", "unknown"),
            "text":      data.get("text", ""),
            "topic":     data.get("topic", "general"),
            "timestamp": str(data.get("created_at", "")),
        })
    return statements


def get_known_contradiction_ids(db: firestore.Client, session_id: str) -> set[str]:
    """Return IDs of contradictions already saved, to avoid duplicates."""
    docs = (
        db.collection("sessions")
        .document(session_id)
        .collection("contradictions")
        .stream()
    )
    return {doc.id for doc in docs}


def save_contradiction(
    db: firestore.Client,
    session_id: str,
    contradiction: dict
):
    """Write a contradiction alert to Firestore."""
    ref = (
        db.collection("sessions")
        .document(session_id)
        .collection("contradictions")
        .document()
    )
    ref.set({
        **contradiction,
        "detected_at": firestore.SERVER_TIMESTAMP,
    })
    print(f"[CONTRADICTION] Saved: {contradiction.get('summary', '')}")


# ── Gemini contradiction check ───────────────────────────────────────────────

async def check_contradictions(
    client: genai.Client,
    engine_prompt: str,
    statements: list[dict],
    known_ids: set[str],
) -> dict | None:
    """
    Send all current statements to Gemini and ask it to find contradictions.
    Returns a parsed contradiction dict, or None if no conflict found.
    """
    if len(statements) < 2:
        return None  # Need at least two statements to compare

    statements_json = json.dumps(statements, indent=2, default=str)

    user_message = f"""
Analyse the following witness statements for contradictions.
Previously flagged contradiction count: {len(known_ids)}
(Do not re-flag contradictions you have already reported.)

STATEMENTS:
{statements_json}
"""

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=engine_prompt,
            temperature=0.1,   # Low temperature for consistent analysis
            max_output_tokens=512,
        ),
    )

    raw = response.text.strip()

    # Strip markdown code fences if Gemini wraps in ```json
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1])

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        print(f"[WARN] Could not parse Gemini response as JSON:\n{raw[:200]}")
        return None

    if result.get("status") == "no_conflict":
        return None

    return result


# ── Main polling loop ────────────────────────────────────────────────────────

async def run_engine(session_id: str, poll_interval: int = 15):
    client          = genai.Client()
    db              = firestore.Client()
    engine_prompt   = load_engine_prompt()

    print("=" * 55)
    print("  THE WITNESS — Contradiction Engine")
    print("=" * 55)
    print(f"  Session  : {session_id}")
    print(f"  Polling  : every {poll_interval}s")
    print("=" * 55)
    print()
    print("Engine running. Ctrl+C to stop.\n")

    while True:
        try:
            statements  = get_all_statements(db, session_id)
            known_ids   = get_known_contradiction_ids(db, session_id)

            print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                  f"Checking {len(statements)} statements, "
                  f"{len(known_ids)} contradictions already found...")

            contradiction = await check_contradictions(
                client, engine_prompt, statements, known_ids
            )

            if contradiction:
                save_contradiction(db, session_id, contradiction)
            else:
                print("  → No new contradictions detected.")

        except Exception as e:
            print(f"[ERROR] Engine loop failed: {e}")

        await asyncio.sleep(poll_interval)


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="The Witness — Contradiction Engine"
    )
    parser.add_argument(
        "--session", required=True,
        help="Session ID to monitor (same as your witness runner)"
    )
    parser.add_argument(
        "--interval", type=int, default=15,
        help="Polling interval in seconds (default: 15)"
    )
    args = parser.parse_args()

    asyncio.run(run_engine(args.session, args.interval))
