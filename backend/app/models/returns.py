import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReturnRequest(Base):
    __tablename__ = "return_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"ret-{uuid.uuid4().hex[:8].upper()}")
    order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.id"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    container_ids_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, default="REQUESTED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    collected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ReturnInspection(Base):
    __tablename__ = "return_inspections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"rni-{uuid.uuid4().hex[:8].upper()}")
    return_id: Mapped[str] = mapped_column(String, ForeignKey("return_requests.id"), nullable=False, index=True)
    container_id: Mapped[str] = mapped_column(String, ForeignKey("containers.id"), nullable=False)
    condition: Mapped[str] = mapped_column(String, nullable=False)
    contains_panels: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    inspected_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    inspected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
