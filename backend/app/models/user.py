import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class User(Base):
    """Links to a Supabase Auth user. Email, password, and name live in auth.users."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True) 
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())