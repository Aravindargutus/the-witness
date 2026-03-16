from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator

_SAFE_NAME_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '-_.")


class Player(BaseModel):
    player_id: str
    name: str = Field(..., min_length=1, max_length=50)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_online: bool = True
    current_witness: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if not all(c in _SAFE_NAME_CHARS for c in v):
            raise ValueError("Name contains invalid characters")
        return v


class SessionCreate(BaseModel):
    host_name: str = Field(..., min_length=1, max_length=50)

    @field_validator("host_name")
    @classmethod
    def validate_host_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if not all(c in _SAFE_NAME_CHARS for c in v):
            raise ValueError("Name contains invalid characters")
        return v


class Session(BaseModel):
    session_id: str
    case_code: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24)
    )
    status: str = "active"  # active | deliberation | closed
    players: list[Player] = Field(default_factory=list)
    time_limit_minutes: int = 20
