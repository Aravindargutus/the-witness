from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class Player(BaseModel):
    player_id: str
    name: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_online: bool = True
    current_witness: Optional[str] = None


class SessionCreate(BaseModel):
    host_name: str


class Session(BaseModel):
    session_id: str
    case_code: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "active"  # active | deliberation | closed
    players: list[Player] = Field(default_factory=list)
    time_limit_minutes: int = 20
