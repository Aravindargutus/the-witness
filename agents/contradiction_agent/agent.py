"""
agents/contradiction_agent/agent.py
─────────────────────────────────────────────────────────────────────────────
The Witness — Contradiction Engine (ADK version)

A proper Google ADK agent with Firestore tools.
The LLM decides when to call each tool based on docstrings.

Folder structure required:
    agents/
    └── contradiction_agent/
        ├── agent.py          ← this file
        ├── __init__.py
        └── .env

Run locally:
    cd agents/
    adk run contradiction_agent

Or run programmatically (e.g. from a Cloud Run scheduler):
    python -m contradiction_agent.runner --session CASE001
"""

import os
import json
from datetime import datetime
from typing import Any
from pathlib import Path

from google.adk.agents import LlmAgent
from google.cloud import firestore

# ── Firestore client (module-level, reused across tool calls) ─────────────
_db = firestore.Client()


# ─────────────────────────────────────────────────────────────────────────────
# TOOL 1 — Read all witness statements for a session
# ─────────────────────────────────────────────────────────────────────────────

def get_statements(session_id: str) -> dict:
    """
    Retrieve all witness statements recorded during an interrogation session.

    Use this tool first at the start of each analysis cycle to load
    the latest statements from all three witnesses (meena, arjun, rajan).

    Args:
        session_id: The case session identifier (e.g. "CASE001").

    Returns:
        A dict with:
            - statements: list of statement objects, each containing
              witness, text, topic, and timestamp fields.
            - count: total number of statements found.
    """
    try:
        docs = (
            _db.collection("sessions")
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
        return {"statements": statements, "count": len(statements)}

    except Exception as e:
        return {"error": str(e), "statements": [], "count": 0}


# ─────────────────────────────────────────────────────────────────────────────
# TOOL 2 — Read already-flagged contradictions (to avoid duplicates)
# ─────────────────────────────────────────────────────────────────────────────

def get_existing_contradictions(session_id: str) -> dict:
    """
    Retrieve all contradiction alerts that have already been saved for
    this session. Use this before saving a new contradiction to avoid
    flagging the same conflict twice.

    Args:
        session_id: The case session identifier.

    Returns:
        A dict with:
            - contradictions: list of previously saved contradiction summaries.
            - count: number of contradictions already recorded.
    """
    try:
        docs = (
            _db.collection("sessions")
            .document(session_id)
            .collection("contradictions")
            .stream()
        )
        contradictions = []
        for doc in docs:
            data = doc.to_dict()
            contradictions.append({
                "id":      doc.id,
                "summary": data.get("summary", ""),
                "topic":   data.get("topic", ""),
                "witnesses_involved": data.get("witnesses_involved", []),
            })
        return {"contradictions": contradictions, "count": len(contradictions)}

    except Exception as e:
        return {"error": str(e), "contradictions": [], "count": 0}


# ─────────────────────────────────────────────────────────────────────────────
# TOOL 3 — Save a new contradiction alert
# ─────────────────────────────────────────────────────────────────────────────

def save_contradiction(
    session_id: str,
    contradiction_type: str,
    confidence: str,
    witnesses_involved: str,
    topic: str,
    summary: str,
    detail: str,
    suggested_followup: str,
) -> dict:
    """
    Save a newly detected contradiction alert to Firestore.
    The React Case Board listens to this collection in real time and will
    immediately display the alert to all detectives on the shared board.

    Only call this tool when you have identified a GENUINE factual conflict
    between two witness statements or between a statement and known evidence.
    Do NOT call it for vague inconsistencies or mere differences in detail.

    Args:
        session_id: The case session identifier.
        contradiction_type: One of "cross_witness", "self_contradiction",
                            or "ground_truth_conflict".
        confidence: One of "high", "medium", or "low".
        witnesses_involved: Comma-separated witness IDs, e.g. "meena,rajan".
        topic: Category of the conflict — one of "timeline", "location",
               "access", "motive", "other_witness", or "general".
        summary: One clear sentence describing the conflict. This appears
                 as the headline on the Case Board alert card.
        detail: Full explanation of what the two conflicting statements say
                and why they cannot both be true.
        suggested_followup: One specific question the detective should ask
                            next to resolve this contradiction.

    Returns:
        A dict with "status" ("saved" or "error") and the Firestore document id.
    """
    try:
        ref = (
            _db.collection("sessions")
            .document(session_id)
            .collection("contradictions")
            .document()
        )
        ref.set({
            "type":                 contradiction_type,
            "confidence":           confidence,
            "witnesses_involved":   [w.strip() for w in witnesses_involved.split(",")],
            "topic":                topic,
            "summary":              summary,
            "detail":               detail,
            "suggested_followup":   suggested_followup,
            "detected_at":          firestore.SERVER_TIMESTAMP,
        })
        print(f"\n[CONTRADICTION SAVED] {summary}")
        return {"status": "saved", "document_id": ref.id}

    except Exception as e:
        return {"status": "error", "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# TOOL 4 — Get ground truth facts (known physical evidence)
# ─────────────────────────────────────────────────────────────────────────────

def get_ground_truth(session_id: str) -> dict:
    """
    Retrieve the verified physical evidence and known facts for this case.
    These are facts independently established by the investigation before
    the interrogations began. Use them to check if any witness statement
    contradicts hard evidence.

    Args:
        session_id: The case session identifier (not used for lookup,
                    facts are the same for all sessions of case #0047).

    Returns:
        A dict containing a list of verified_facts, each with a
        description and source field.
    """
    return {
        "case": "0047 — The Locked Lab",
        "victim": "Dr. Shalini Rao, found Lab 3B, midnight",
        "time_of_death": "estimated between 23:00 and 23:30",
        "verified_facts": [
            {
                "fact": "Meena's keycard swiped on floor 3 at 23:02 (11:02pm)",
                "source": "Building access control log",
                "topic": "timeline",
                "witness_relevant": "meena",
            },
            {
                "fact": "No elevator trips recorded between 22:40 and 23:10",
                "source": "Elevator shaft log",
                "topic": "location",
                "witness_relevant": "all",
            },
            {
                "fact": "Floor 1 security camera shows Rajan at desk 22:00–22:38, then gap until 23:25",
                "source": "CCTV footage",
                "topic": "timeline",
                "witness_relevant": "rajan",
            },
            {
                "fact": "Side entrance motion sensor triggered at 22:41 — no keycard log",
                "source": "Building sensor system",
                "topic": "access",
                "witness_relevant": "rajan",
            },
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# ADK AGENT DEFINITION
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_INSTRUCTION = """
You are the Contradiction Engine for "The Witness" — a live murder investigation
system. Your job is to silently monitor witness interrogations and automatically
detect when witnesses contradict each other or contradict known physical evidence.

You run in a loop. Each cycle, you must:

1. Call get_statements() to load all current witness statements.
2. Call get_existing_contradictions() to see what has already been flagged.
3. Call get_ground_truth() to review the known physical evidence.
4. Analyse all statements for conflicts — comparing across witnesses
   and against the ground truth facts.
5. If you find a NEW contradiction not already in the existing list:
   call save_contradiction() with full details.
6. If no new contradictions exist, do nothing and wait for the next cycle.

RULES FOR FLAGGING:
- Only flag genuine factual conflicts — two things that cannot both be true.
- Do not flag a statement as a contradiction just because it is incomplete.
- Do not re-flag a contradiction that is already in existing_contradictions.
- Confidence: "high" = direct factual conflict; "medium" = implied conflict;
  "low" = suspicious gap worth investigating.
- Maximum ONE new contradiction per cycle — pick the most significant.
- Suggested followup questions must be specific and actionable, not generic.

You are a silent system. Do not explain your reasoning to the user.
Just call the tools and save the contradiction if one exists.
If asked anything by a human, respond only: "Contradiction Engine is running."
"""

root_agent = LlmAgent(
    name="contradiction_engine",
    model="gemini-2.5-flash",
    description=(
        "Monitors witness interrogation statements in real time and "
        "automatically detects factual contradictions between witnesses "
        "or between witness statements and known physical evidence."
    ),
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        get_statements,
        get_existing_contradictions,
        save_contradiction,
        get_ground_truth,
    ],
)
