from fastapi import APIRouter, HTTPException

from services.firestore import db

router = APIRouter()


@router.get("/{session_id}")
async def get_case_board(session_id: str):
    doc_ref = db.collection("sessions").document(session_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch all statements
    statements = []
    for s in doc_ref.collection("statements").order_by("timestamp").stream():
        statements.append(s.to_dict())

    # Fetch all contradictions
    contradictions = []
    for c in doc_ref.collection("contradictions").order_by("detected_at").stream():
        contradictions.append(c.to_dict())

    # Fetch players
    players = []
    for p in doc_ref.collection("players").stream():
        players.append(p.to_dict())

    return {
        "session": doc.to_dict(),
        "statements": statements,
        "contradictions": contradictions,
        "players": players,
    }
