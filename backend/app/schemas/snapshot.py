import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SnapshotMeta(BaseModel):
    id: uuid.UUID
    label: str | None
    is_manual: bool
    created_at: datetime
    size: int  


class SnapshotDetail(SnapshotMeta):
    content: str


class SnapshotCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    label: str = Field(min_length=1, max_length=80)