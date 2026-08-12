from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base


class MLModel(Base):
    __tablename__ = "models"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    experiment_id: Mapped[int] = mapped_column(
        ForeignKey("experiments.id"),
        nullable=False,
        index=True,
    )

    model_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    metrics: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    mlflow_run_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )