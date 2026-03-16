import json
import os
import re
import uuid
from datetime import datetime

from google import genai
from google.genai import types
from services.firestore import db
from models.contradiction import Contradiction

# Module-level singleton — avoids recreating the client on every LLM call
_genai_client: genai.Client | None = None


def _get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    return _genai_client


def _parse_json_response(text: str) -> dict:
    """Robustly extract a JSON object from an LLM response."""
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip common code-fence wrappers
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    # Fallback: extract first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}

COMPARISON_PROMPT = """You are the Contradiction Engine for "The Witness" murder investigation.

Given two witness statements, determine if they contradict each other or contradict known ground truth.

GROUND TRUTH FACTS:
- Meena's keycard was swiped on floor 3 at 23:02 (11:02pm)
- The building's elevator log shows no trips between 22:40 and 23:10
- Security camera on floor 1 shows Rajan at his desk from 22:00–22:38, then a gap until 23:25
- Shalini's time of death: estimated between 23:00 and 23:30
- The side entrance motion sensor triggered at 22:41

Statement A (by {witness_a}): "{text_a}"
Statement B (by {witness_b}): "{text_b}"

If there is a contradiction, respond with EXACTLY this JSON:
{{"type": "cross_witness", "confidence": "high|medium|low", "witnesses_involved": ["{witness_a}", "{witness_b}"], "topic": "<short topic>", "summary": "<one sentence>", "detail": "<specific comparison>", "suggested_followup": "<question for detective>"}}

If no contradiction, respond with:
{{"status": "no_conflict"}}

Confidence rules:
- high: Direct factual conflict or contradiction with ground truth
- medium: Implied conflict — one statement makes another unlikely
- low: Suspicious gap or vagueness warranting follow-up"""


async def check_contradictions(session_id: str):
    """Compare all statements in a session and flag new contradictions."""
    doc_ref = db.collection("sessions").document(session_id)
    statements = []
    for s in doc_ref.collection("statements").order_by("timestamp").stream():
        statements.append(s.to_dict())

    # Cap to most recent 50 to keep O(n²) LLM calls bounded
    statements = statements[-50:]

    if len(statements) < 2:
        return []

    # Get existing contradiction pairs to avoid duplicates
    existing_pairs = set()
    for c in doc_ref.collection("contradictions").stream():
        d = c.to_dict()
        pair = frozenset([d["statement_a_id"], d["statement_b_id"]])
        existing_pairs.add(pair)

    new_contradictions = []

    # Compare each pair of statements from different witnesses
    for i, sa in enumerate(statements):
        for sb in statements[i + 1 :]:
            if sa["witness_id"] == sb["witness_id"]:
                continue

            pair = frozenset([sa["statement_id"], sb["statement_id"]])
            if pair in existing_pairs:
                continue

            prompt = COMPARISON_PROMPT.format(
                witness_a=sa["witness_id"],
                text_a=sa["text"],
                witness_b=sb["witness_id"],
                text_b=sb["text"],
            )

            try:
                client = _get_genai_client()
                response = await client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
                )
                result = _parse_json_response(response.text or "")

                if result.get("type") and result.get("status") != "no_conflict":
                    contradiction = Contradiction(
                        contradiction_id=str(uuid.uuid4()),
                        session_id=session_id,
                        witness_a=sa["witness_id"],
                        witness_b=sb["witness_id"],
                        statement_a_id=sa["statement_id"],
                        statement_b_id=sb["statement_id"],
                        topic=result.get("topic", "unknown"),
                        summary=result.get("summary", ""),
                        confidence=result.get("confidence", "medium"),
                    )

                    doc_ref.collection("contradictions").document(
                        contradiction.contradiction_id
                    ).set(contradiction.model_dump(mode="json"))

                    new_contradictions.append(contradiction)

            except Exception:
                # Skip pairs that fail to parse — non-critical
                continue

    return new_contradictions
