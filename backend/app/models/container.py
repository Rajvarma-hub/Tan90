import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Container(Base):
    __tablename__ = "containers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"con-{uuid.uuid4().hex[:8].upper()}")
    container_code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    container_type: Mapped[str] = mapped_column(String, nullable=False)
    capacity_litres: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="AVAILABLE", index=True)
    current_location_id: Mapped[str | None] = mapped_column(String, ForeignKey("locations.id"), nullable=True)
    current_customer_id: Mapped[str | None] = mapped_column(String, ForeignKey("customers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
