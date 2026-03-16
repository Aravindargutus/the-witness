from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.firestore import db

router = APIRouter()


class VerdictSubmit(BaseModel):
    player_id: str
    accused_witness: str  # witness_id of who they think did it
    reasoning: str


@router.post("/{session_id}")
async def submit_verdict(session_id: str, body: VerdictSubmit):
    doc_ref = db.collection("sessions").document(session_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")

    # The real killer is Divya Rao (Shalini's sister, let in by Rajan)
    # Players accuse a witness, but the truth is none of them did it —
    # it was Divya. Accept "divya" as the correct answer.
    correct = body.accused_witness == "divya"

    result = {
        "correct": correct,
        "accused": body.accused_witness,
        "reasoning": body.reasoning,
        "reveal": (
            "The killer was Divya Rao — Dr. Shalini Rao's sister. "
            "Shalini had pledged the family property as collateral for the institute's "
            "patent filing without telling Divya. Rajan let Divya into the building at "
            "10:40pm through the side entrance. The argument in Lab 3B turned violent. "
            "Divya did not plan it. Rajan found Shalini at 11:20pm but covered for Divya."
        )
        if correct
        else (
            "Not quite. None of the three witnesses killed Dr. Shalini Rao. "
            "Look at the contradictions again — who was let into the building "
            "that night? Who is Rajan protecting?"
        ),
    }

    # Update session status
    doc_ref.update({"status": "closed"})

    return result
