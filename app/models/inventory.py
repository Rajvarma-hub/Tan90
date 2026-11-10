import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"
    __table_args__ = (UniqueConstraint("product_id", "location_id", name="uq_inv_prod_loc"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"inv-{uuid.uuid4().hex[:8].upper()}")
    product_id: Mapped[str] = mapped_column(String, ForeignKey("products.id"), nullable=False, index=True)
    location_id: Mapped[str] = mapped_column(String, ForeignKey("locations.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"imv-{uuid.uuid4().hex[:8].upper()}")
    product_id: Mapped[str] = mapped_column(String, ForeignKey("products.id"), nullable=False)
    location_id: Mapped[str] = mapped_column(String, ForeignKey("locations.id"), nullable=False)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    reference_type: Mapped[str] = mapped_column(String, nullable=False)
    reference_id: Mapped[str] = mapped_column(String, nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
