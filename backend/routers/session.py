import uuid
import random
import string

from fastapi import APIRouter, HTTPException

from models.session import Session, SessionCreate, Player
from services.firestore import db

router = APIRouter()


def _generate_case_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.post("/start", response_model=Session)
async def start_session(body: SessionCreate):
    session_id = str(uuid.uuid4())
    case_code = _generate_case_code()

    host = Player(player_id=str(uuid.uuid4()), name=body.host_name)
    session = Session(
        session_id=session_id,
        case_code=case_code,
        players=[host],
    )

    doc = db.collection("sessions").document(session_id)
    doc.set(session.model_dump(mode="json"))

    # Create the host player sub-document
    doc.collection("players").document(host.player_id).set(
        host.model_dump(mode="json")
    )

    return session


@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: str):
    doc = db.collection("sessions").document(session_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")
    return Session(**doc.to_dict())


@router.post("/{session_id}/join")
async def join_session(session_id: str, player_name: str):
    doc_ref = db.collection("sessions").document(session_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")

    player = Player(player_id=str(uuid.uuid4()), name=player_name)
    doc_ref.collection("players").document(player.player_id).set(
        player.model_dump(mode="json")
    )

    return player.model_dump(mode="json")
