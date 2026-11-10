import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.location import Location
from app.models.order import Order
from app.models.user import User
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/api/stations", tags=["stations"])


# ─── List ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[LocationOut])
def list_locations(
    kind: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Location)
    if kind:
        if kind not in ("WAREHOUSE", "FREEZING_STATION"):
            raise HTTPException(400, "kind must be WAREHOUSE or FREEZING_STATION")
        q = q.filter(Location.kind == kind)
    return q.order_by(Location.code).all()


# ─── Get detail ────────────────────────────────────────────────────────

@router.get("/{location_id}", response_model=LocationOut)
def get_location(
    location_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Location not found")
    return loc


# ─── Create ────────────────────────────────────────────────────────────

@router.post("", response_model=LocationOut, status_code=201)
def create_location(
    payload: LocationCreate,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
    db: Session = Depends(get_db),
):
    if db.query(Location).filter(Location.code == payload.code).first():
        raise HTTPException(409, f"Location code {payload.code} already exists")

    loc = Location(
        code=payload.code, name=payload.name, kind=payload.kind,
        address=payload.address, is_active=True,
    )
    db.add(loc)
    db.flush()
    db.add(AuditLog(
        entity_type="location", entity_id=loc.id, action="LOCATION_CREATED",
        actor_id=user.id,
        details_json=json.dumps({"code": loc.code, "kind": loc.kind}),
    ))
    db.commit()
    db.refresh(loc)
    return loc


# ─── Update ────────────────────────────────────────────────────────────

@router.patch("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: str,
    payload: LocationUpdate,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
    db: Session = Depends(get_db),
):
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Location not found")

    changed = payload.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(loc, k, v)
    db.add(AuditLog(
        entity_type="location", entity_id=loc.id, action="LOCATION_UPDATED",
        actor_id=user.id, details_json=json.dumps(changed),
    ))
    db.commit()
    db.refresh(loc)
    return loc


# ─── Work queue ────────────────────────────────────────────────────────

@router.get("/{location_id}/work-queue")
def work_queue(
    location_id: str,
    user: User = Depends(require_roles(
        "SUPER_ADMIN", "OPERATIONS_ADMIN",
        "FREEZING_STATION_MANAGER", "PACKING_WORKER")),
    db: Session = Depends(get_db),
):
    station = db.get(Location, location_id)
    if not station:
        raise HTTPException(404, "Station not found")
    if station.kind != "FREEZING_STATION":
        raise HTTPException(400, "Work queues exist only for freezing stations")
    if user.role in ("FREEZING_STATION_MANAGER", "PACKING_WORKER") \
            and user.location_id != station.id:
        raise HTTPException(403, "Not your station")

    orders = db.query(Order).filter(
        Order.station_id == location_id,
        Order.status.in_(["APPROVED", "PACKING"]),
    ).order_by(Order.created_at).all()

    return [
        {"id": o.id, "order_number": o.order_number,
         "status": o.status, "customer_id": o.customer_id}
        for o in orders
    ]
