import uuid

from fastapi import APIRouter, HTTPException

from models.statement import Statement, StatementCreate
from services.firestore import db

router = APIRouter()


@router.post("/", response_model=Statement)
async def save_statement(session_id: str, body: StatementCreate):
    doc_ref = db.collection("sessions").document(session_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Session not found")

    statement_id = str(uuid.uuid4())
    statement = Statement(
        statement_id=statement_id,
        session_id=session_id,
        witness_id=body.witness_id,
        player_id=body.player_id,
        text=body.text,
        claims=[c.model_dump() for c in body.claims],
    )

    doc_ref.collection("statements").document(statement_id).set(
        statement.model_dump(mode="json")
    )

    return statement
