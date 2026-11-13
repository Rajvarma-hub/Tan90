from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.inventory import InventoryBalance, InventoryMovement
from app.models.location import Location
from app.models.product import Product
from app.models.user import User
from app.schemas.inventory import StockMovementIn
from app.services import inventory as inventory_service

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

STOCK_ROLES = (
    "SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER", "WAREHOUSE",
)
STATION_SCOPED = ("FREEZING_STATION_MANAGER", "PACKING_WORKER", "WAREHOUSE")


def _scope(user: User, location_id: str | None) -> str | None:
    """Station-scoped roles only ever see their own location."""
    if user.role in STATION_SCOPED and user.location_id:
        return user.location_id
    return location_id


@router.get("")
def list_balances(
    location_id: str | None = None,
    product_id: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == "CUSTOMER":
        raise HTTPException(403, "Insufficient permissions")
    q = db.query(InventoryBalance, Product, Location).join(
        Product, Product.id == InventoryBalance.product_id
    ).join(Location, Location.id == InventoryBalance.location_id)
    location_id = _scope(user, location_id)
    if location_id:
        q = q.filter(InventoryBalance.location_id == location_id)
    if product_id:
        q = q.filter(InventoryBalance.product_id == product_id)
    return [
        {
            "id": b.id, "quantity": b.quantity,
            "product_id": p.id, "sku": p.sku, "product_name": p.name,
            "setpoint_c": p.setpoint_c, "unit": p.unit,
            "location_id": loc.id, "location_code": loc.code,
            "location_name": loc.name, "location_kind": loc.kind,
        }
        for b, p, loc in q.order_by(Location.code, Product.sku).all()
    ]


@router.get("/movements")
def list_movements(
    location_id: str | None = None,
    product_id: str | None = None,
    direction: str | None = Query(None, pattern="^(INWARD|OUTWARD)$"),
    limit: int = Query(200, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == "CUSTOMER":
        raise HTTPException(403, "Insufficient permissions")
    q = db.query(InventoryMovement, Product, Location).join(
        Product, Product.id == InventoryMovement.product_id
    ).join(Location, Location.id == InventoryMovement.location_id)
    location_id = _scope(user, location_id)
    if location_id:
        q = q.filter(InventoryMovement.location_id == location_id)
    if product_id:
        q = q.filter(InventoryMovement.product_id == product_id)
    if direction == "INWARD":
        q = q.filter(InventoryMovement.delta > 0)
    elif direction == "OUTWARD":
        q = q.filter(InventoryMovement.delta < 0)
    rows = q.order_by(InventoryMovement.occurred_at.desc()).limit(limit).all()

    actors = {
        u.id: u.full_name for u in db.query(User).filter(
            User.id.in_({m.actor_id for m, _, _ in rows if m.actor_id})).all()
    }
    return [
        {
            "id": m.id, "delta": m.delta,
            "direction": "INWARD" if m.delta > 0 else "OUTWARD",
            "quantity": abs(m.delta), "reason": m.reason,
            "reference_type": m.reference_type, "reference_id": m.reference_id,
            "product_id": p.id, "sku": p.sku, "product_name": p.name,
            "location_id": loc.id, "location_code": loc.code,
            "actor_id": m.actor_id, "actor_name": actors.get(m.actor_id),
            "occurred_at": m.occurred_at,
        }
        for m, p, loc in rows
    ]


@router.post("/movements", status_code=201)
def record_movement(
    payload: StockMovementIn,
    user: User = Depends(require_roles(*STOCK_ROLES)),
    db: Session = Depends(get_db),
):
    """Manual stock movement: receive new inventory, write off damage, adjust, or transfer."""
    if user.role in STATION_SCOPED and user.location_id != payload.location_id:
        raise HTTPException(403, "You can only move stock at your own location")
    if not db.get(Product, payload.product_id):
        raise HTTPException(404, "Product not found")
    if not db.get(Location, payload.location_id):
        raise HTTPException(404, "Location not found")

    reference = (payload.reference or "").strip() or "—"

    if payload.reason == "INTERNAL_TRANSFER":
        if not payload.to_location_id or payload.to_location_id == payload.location_id:
            raise HTTPException(400, "Transfer needs a different destination location")
        if not db.get(Location, payload.to_location_id):
            raise HTTPException(404, "Destination location not found")
        inventory_service.apply_movement(
            db, product_id=payload.product_id, location_id=payload.location_id,
            delta=-payload.quantity, reason="INTERNAL_TRANSFER",
            reference_type="LOCATION", reference_id=payload.to_location_id,
            actor_id=user.id)
        inventory_service.apply_movement(
            db, product_id=payload.product_id, location_id=payload.to_location_id,
            delta=payload.quantity, reason="INTERNAL_TRANSFER",
            reference_type="LOCATION", reference_id=payload.location_id,
            actor_id=user.id)
    else:
        if payload.reason == "NEW_INVENTORY" and payload.direction != "INWARD":
            raise HTTPException(400, "New inventory is always inward")
        if payload.reason == "DAMAGED" and payload.direction != "OUTWARD":
            raise HTTPException(400, "Damaged stock is always outward")
        sign = 1 if payload.direction == "INWARD" else -1
        inventory_service.apply_movement(
            db, product_id=payload.product_id, location_id=payload.location_id,
            delta=sign * payload.quantity, reason=payload.reason,
            reference_type="MANUAL", reference_id=reference, actor_id=user.id)

    db.commit()
    return {"ok": True}
