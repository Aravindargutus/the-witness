from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class Claim(BaseModel):
    topic: str  # e.g. "location_at_11pm", "relationship_with_victim"
    value: str  # e.g. "Floor 3", "Professional only"
    confidence: float = 1.0


class StatementCreate(BaseModel):
    witness_id: str
    player_id: str
    text: str
    claims: list[Claim] = []


class Statement(BaseModel):
    statement_id: str
    session_id: str
    witness_id: str
    player_id: str
    text: str
    claims: list[Claim] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_lie: bool = False
    source: str = "voice"  # voice | text
