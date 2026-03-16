"""
runner.py
─────────
Main entry point for The Witness agent system.

Usage:
    python runner.py --witness meena --session SESSION_ID
    python runner.py --witness arjun --session SESSION_ID
    python runner.py --witness rajan --session SESSION_ID

Each command starts a live voice interrogation session with one witness.
Statements are automatically saved to Firestore under:
    sessions/{SESSION_ID}/statements/{auto-id}

The contradiction engine reads from the same Firestore path.

Requirements:
    pip install google-genai google-cloud-firestore pyaudio python-dotenv
    export GOOGLE_API_KEY=your_key
    export GOOGLE_CLOUD_PROJECT=your_project_id

NOTE: Use headphones. No echo cancellation is applied here.
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


# ── Validate environment ────────────────────────────────────────────────────

def check_env():
    missing = []
    if not os.getenv("GOOGLE_API_KEY"):
        missing.append("GOOGLE_API_KEY")
    if not os.getenv("GOOGLE_CLOUD_PROJECT"):
        missing.append("GOOGLE_CLOUD_PROJECT")
    if missing:
        print(f"[ERROR] Missing environment variables: {', '.join(missing)}")
        print("Create a .env file — see .env.example")
        sys.exit(1)


# ── Witness registry ────────────────────────────────────────────────────────

def get_agent(witness_name: str, session_id: str):
    """
    Import and return the correct witness agent class.
    Kept as lazy imports so each agent file is only loaded if needed.
    """
    if witness_name == "meena":
        from witnesses.meena import MeenaAgent
        return MeenaAgent(session_id)

    elif witness_name == "arjun":
        from witnesses.arjun import ArjunAgent
        return ArjunAgent(session_id)

    elif witness_name == "rajan":
        from witnesses.rajan import RajanAgent
        return RajanAgent(session_id)

    else:
        print(f"[ERROR] Unknown witness: '{witness_name}'")
        print("Valid options: meena, arjun, rajan")
        sys.exit(1)


# ── Session ID helper ───────────────────────────────────────────────────────

def make_session_id() -> str:
    """Generate a short human-readable session ID if none is provided."""
    import uuid
    return f"case-{uuid.uuid4().hex[:6].upper()}"


# ── Main ────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="The Witness — live voice interrogation agent"
    )
    parser.add_argument(
        "--witness",
        required=True,
        choices=["meena", "arjun", "rajan"],
        help="Which witness to interrogate"
    )
    parser.add_argument(
        "--session",
        default=None,
        help="Session ID (shared with teammates on the Case Board). "
             "If omitted, a new one is generated."
    )
    args = parser.parse_args()

    check_env()

    session_id = args.session or make_session_id()

    print("=" * 55)
    print("  THE WITNESS — Live Interrogation System")
    print("=" * 55)
    print(f"  Witness  : {args.witness.upper()}")
    print(f"  Session  : {session_id}")
    print(f"  Case     : The Locked Lab — #0047")
    print("=" * 55)
    print()

    agent = get_agent(args.witness, session_id)

    try:
        await agent.run()
    except KeyboardInterrupt:
        print(f"\n[{args.witness.upper()}] Session ended.")
        print(f"Statements saved to Firestore under session: {session_id}")
        print("Share this session ID with your team to view the Case Board.")


if __name__ == "__main__":
    asyncio.run(main())
