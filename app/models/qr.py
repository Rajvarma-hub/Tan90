import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class QRToken(Base):
    """Secure one-time QR token for customer delivery verification."""
    __tablename__ = "qr_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"qr-{uuid.uuid4().hex[:8].upper()}")
    order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_by_user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
