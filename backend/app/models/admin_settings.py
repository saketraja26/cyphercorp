from datetime import datetime

from sqlalchemy import DateTime, String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base


class AdminSettings(Base):
    """
    Single-row settings table for admin-configurable AI provider selection.
    Only one row (id=1) should ever exist — enforced at the application layer.
    """
    __tablename__ = "admin_settings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1,
    )

    active_provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="auto",  # "auto" | "openai" | "gemini"
    )

    active_model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
