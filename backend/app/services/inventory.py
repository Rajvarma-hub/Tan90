"""Stock ledger. Every change to inventory_balances goes through apply_movement."""
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.inventory import InventoryBalance, InventoryMovement
from app.models.product import Product
from app.services import notifications as notif


def apply_movement(db: Session, *, product_id: str, location_id: str, delta: int,
                   reason: str, reference_type: str, reference_id: str,
                   actor_id: str | None) -> InventoryBalance:
    """Adjust a balance by `delta` and record the movement. Does not commit."""
    bal = db.query(InventoryBalance).filter(
        InventoryBalance.product_id == product_id,
        InventoryBalance.location_id == location_id,
    ).first()
    if not bal:
        bal = InventoryBalance(product_id=product_id, location_id=location_id, quantity=0)
        db.add(bal)
        db.flush()
    if bal.quantity + delta < 0:
        raise HTTPException(409, {
            "message": "Insufficient stock",
            "product_id": product_id, "location_id": location_id,
            "available": bal.quantity, "requested": -delta,
        })
    before = _total_stock(db, product_id)
    bal.quantity += delta
    db.add(InventoryMovement(
        product_id=product_id, location_id=location_id, delta=delta,
        reason=reason, reference_type=reference_type, reference_id=reference_id,
        actor_id=actor_id,
    ))
    _warn_if_low(db, product_id, before, before + delta)
    return bal


def _total_stock(db: Session, product_id: str) -> int:
    db.flush()
    return db.query(func.coalesce(func.sum(InventoryBalance.quantity), 0)).filter(
        InventoryBalance.product_id == product_id).scalar()


def _warn_if_low(db: Session, product_id: str, before: int, after: int) -> None:
    """Tell Ops once, when total stock first falls to the product's reorder level."""
    product = db.get(Product, product_id)
    if not product or product.reorder_level <= 0 or not product.is_active:
        return
    if before > product.reorder_level >= after:
        notif.notify_role(
            db, "OPERATIONS_ADMIN", kind="LOW_STOCK",
            title=f"Low stock: {product.name}",
            body=f"{after} {product.unit}s left in total (reorder level {product.reorder_level}).",
            reference_type="product", reference_id=product.id,
        )
