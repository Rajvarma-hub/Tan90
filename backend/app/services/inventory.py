"""Stock ledger. Every change to inventory_balances goes through apply_movement."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.inventory import InventoryBalance, InventoryMovement


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
    bal.quantity += delta
    db.add(InventoryMovement(
        product_id=product_id, location_id=location_id, delta=delta,
        reason=reason, reference_type=reference_type, reference_id=reference_id,
        actor_id=actor_id,
    ))
    return bal
