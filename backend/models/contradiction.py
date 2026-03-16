from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class Contradiction(BaseModel):
    contradiction_id: str
    session_id: str
    witness_a: str
    witness_b: str
    statement_a_id: str
    statement_b_id: str
    topic: str
    summary: str  # Human-readable explanation
    confidence: str = "high"  # high | medium | low
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    dismissed: bool = False
