import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (
        CheckConstraint("role in ('owner', 'editor', 'viewer')", name="role_valid"),
        CheckConstraint("user_id is not null or guest_name is not null", name="has_identity"),
        Index(
            "uq_participants_session_user", "session_id", "user_id",
            unique=True, postgresql_where=text("user_id is not null"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sessions.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    guest_name: Mapped[str | None] = mapped_column(Text)  # used when user_id is null
    role: Mapped[str] = mapped_column(Text, server_default="editor")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())