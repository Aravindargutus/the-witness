"""
runner.py — Run the ADK contradiction engine programmatically.

This is the Cloud Run entrypoint. It triggers the ADK agent
on a loop, passing the current session_id as a message.

Usage:
    python runner.py --session CASE001 --interval 15

Or as a Cloud Run job scheduled via Cloud Scheduler.
"""

import asyncio
import argparse
import os
from dotenv import load_dotenv

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agent import root_agent

load_dotenv()

APP_NAME   = "the_witness_contradiction_engine"
USER_ID    = "system"


async def run_cycle(runner: Runner, session_id: str):
    """Run one analysis cycle — the agent checks for contradictions once."""

    # The message tells the agent which session to analyse.
    # The agent's tools use this session_id to read/write Firestore.
    message = (
        f"Analyse session '{session_id}' now. "
        f"Check for new contradictions and save any you find."
    )

    content = types.Content(
        role="user",
        parts=[types.Part(text=message)]
    )

    print(f"[{session_id}] Running contradiction analysis...")

    final_response = None
    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=session_id,
        new_message=content,
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                final_response = event.content.parts[0].text

    if final_response:
        print(f"[Agent] {final_response}")


async def main(session_id: str, interval: int):
    session_service = InMemorySessionService()

    # Create the session once — the agent reuses it across cycles
    # so it remembers what contradictions it has already analysed.
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=session_id,
    )

    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service,
    )

    print("=" * 55)
    print("  THE WITNESS — ADK Contradiction Engine")
    print("=" * 55)
    print(f"  Session  : {session_id}")
    print(f"  Interval : every {interval}s")
    print(f"  Agent    : {root_agent.name}")
    print(f"  Model    : {root_agent.model}")
    print("=" * 55)
    print()

    while True:
        try:
            await run_cycle(runner, session_id)
        except Exception as e:
            print(f"[ERROR] Cycle failed: {e}")

        await asyncio.sleep(interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--session",  required=True, help="Session ID")
    parser.add_argument("--interval", type=int, default=15, help="Poll interval in seconds")
    args = parser.parse_args()

    asyncio.run(main(args.session, args.interval))
