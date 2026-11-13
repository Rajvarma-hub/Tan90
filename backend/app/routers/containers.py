import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.container_types import CONTAINER_TYPES, resolve as resolve_type
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.audit import AuditLog, ContainerMovement
from app.models.container import Container
from app.models.location import Location
from app.models.rfid import RFIDTag
from app.models.user import User
from app.schemas.container import (
    ContainerOut, ContainerRegisterRequest, ReplaceTagRequest,
)

router = APIRouter(prefix="/api/containers", tags=["containers"])

# Roles allowed to register a new physical container.
# Packing workers are included so they can register containers directly
# at the freezing station during the packing session.
REGISTER_ROLES = (
    "SUPER_ADMIN", "OPERATIONS_ADMIN",
    "FREEZING_STATION_MANAGER", "WAREHOUSE", "PACKING_WORKER",
)


def _next_container_code(db: Session) -> str:
    """Use MAX(existing suffix) + 1, not count(*), so deletion is safe."""
    row = db.execute(text(
        "SELECT MAX(CAST(SUBSTR(container_code, 5) AS INTEGER)) FROM containers"
    )).scalar()
    return f"CON-{(row or 0) + 1:06d}"


def _container_dict(db: Session, c: Container) -> dict:
    tag = db.query(RFIDTag).filter(
        RFIDTag.container_id == c.id, RFIDTag.active == True  # noqa: E712
    ).first()
    return {
        "id": c.id,
        "container_code": c.container_code,
        "container_type": c.container_type,
        "capacity_litres": float(c.capacity_litres),
        "status": c.status,
        "current_location_id": c.current_location_id,
        "current_customer_id": c.current_customer_id,
        "epc": tag.epc if tag else None,
    }


# ─── Reference data ────────────────────────────────────────────────

@router.get("/types")
def list_container_types(user: User = Depends(get_current_user)):
    """Return the whitelist so the frontend can populate the picker."""
    return [
        {"code": code, "name": name, "capacity_litres": cap}
        for code, (name, cap) in CONTAINER_TYPES.items()
    ]


# ─── Registration ──────────────────────────────────────────────────

@router.post("", response_model=ContainerOut, status_code=201)
def register_container(
    payload: ContainerRegisterRequest,
    user: User = Depends(require_roles(*REGISTER_ROLES)),
    db: Session = Depends(get_db),
):
    """Scan EPC → pick type → system generates code, derives capacity, links EPC, records location.

    Roles: SUPER_ADMIN, OPERATIONS_ADMIN, FREEZING_STATION_MANAGER, WAREHOUSE, PACKING_WORKER.
    Packers/warehouse are scoped to their own location; admins can register anywhere.
    """
    # Station-scoped roles may only register at their own location.
    if user.role in ("FREEZING_STATION_MANAGER", "PACKING_WORKER", "WAREHOUSE"):
        if user.location_id != payload.location_id:
            raise HTTPException(403, "You can only register containers at your own location")

    location = db.get(Location, payload.location_id)
    if not location:
        raise HTTPException(404, "Location not found")

    try:
        type_name, capacity = resolve_type(payload.container_type_code)
    except KeyError:
        raise HTTPException(
            400,
            f"Unknown container type '{payload.container_type_code}'. "
            f"Valid: {', '.join(sorted(CONTAINER_TYPES))}",
        )

    clash = db.query(RFIDTag).filter(
        RFIDTag.epc == payload.epc, RFIDTag.active == True  # noqa: E712
    ).first()
    if clash:
        raise HTTPException(
            409, f"EPC {payload.epc} already linked to container {clash.container_id}",
        )

    c = Container(
        container_code=_next_container_code(db),
        container_type=type_name,
        capacity_litres=capacity,
        status="AVAILABLE",
        current_location_id=payload.location_id,
    )
    db.add(c)
    db.flush()

    db.add(RFIDTag(epc=payload.epc, container_id=c.id, active=True))
    db.add(ContainerMovement(
        container_id=c.id, from_status=None, to_status="AVAILABLE",
        from_location_id=None, to_location_id=payload.location_id,
        reason="REGISTERED", reference_type="CONTAINER",
        reference_id=c.id, actor_id=user.id,
    ))
    db.add(AuditLog(
        entity_type="container", entity_id=c.id, action="CONTAINER_REGISTERED",
        actor_id=user.id,
        details_json=json.dumps({
            "epc": payload.epc,
            "container_code": c.container_code,
            "type_code": payload.container_type_code,
            "location_id": payload.location_id,
        }),
    ))
    db.commit()
    db.refresh(c)
    return _container_dict(db, c)


@router.post("/{container_id}/replace-tag", response_model=ContainerOut)
def replace_tag(
    container_id: str,
    payload: ReplaceTagRequest,
    user: User = Depends(require_roles(
        "SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER")),
    db: Session = Depends(get_db),
):
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")

    clash = db.query(RFIDTag).filter(
        RFIDTag.epc == payload.new_epc, RFIDTag.active == True  # noqa: E712
    ).first()
    if clash:
        raise HTTPException(409, f"EPC {payload.new_epc} already active")

    old = db.query(RFIDTag).filter(
        RFIDTag.container_id == c.id, RFIDTag.active == True  # noqa: E712
    ).first()
    old_epc = None
    if old:
        old_epc = old.epc
        old.active = False
        old.replaced_at = datetime.now(timezone.utc)

    db.add(RFIDTag(epc=payload.new_epc, container_id=c.id, active=True))
    db.add(AuditLog(
        entity_type="container", entity_id=c.id, action="TAG_REPLACED",
        actor_id=user.id,
        details_json=json.dumps({
            "old_epc": old_epc, "new_epc": payload.new_epc, "reason": payload.reason,
        }),
    ))
    db.commit()
    return _container_dict(db, c)


# ─── Read endpoints ────────────────────────────────────────────────

# /me MUST come before /{container_id} so FastAPI does not treat "me" as an ID.
@router.get("/me", response_model=list[ContainerOut])
def my_containers(user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    if user.role != "CUSTOMER" or not user.customer_id:
        raise HTTPException(403, "Customer-only endpoint")
    rows = db.query(Container).filter(
        Container.current_customer_id == user.customer_id
    ).order_by(Container.container_code).all()
    return [_container_dict(db, c) for c in rows]


@router.get("", response_model=list[ContainerOut])
def list_containers(
    status: str | None = None,
    location_id: str | None = None,
    type_code: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Container)
    if status:
        q = q.filter(Container.status == status)
    if location_id:
        q = q.filter(Container.current_location_id == location_id)
    if type_code:
        try:
            type_name, _ = resolve_type(type_code)
        except KeyError:
            raise HTTPException(400, f"Unknown type_code '{type_code}'")
        q = q.filter(Container.container_type == type_name)

    # Station-scoped roles see only their own location by default
    if user.role in ("FREEZING_STATION_MANAGER", "PACKING_WORKER", "WAREHOUSE") \
            and not location_id and user.location_id:
        q = q.filter(Container.current_location_id == user.location_id)

    rows = q.order_by(Container.container_code).all()
    return [_container_dict(db, c) for c in rows]


@router.get("/{container_id}", response_model=ContainerOut)
def get_container(container_id: str, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")
    return _container_dict(db, c)


@router.get("/{container_id}/history")
def container_history(container_id: str, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")
    rows = db.query(ContainerMovement).filter(
        ContainerMovement.container_id == container_id
    ).order_by(ContainerMovement.occurred_at.desc()).all()
    return [
        {"id": m.id, "from_status": m.from_status, "to_status": m.to_status,
         "reason": m.reason, "reference_type": m.reference_type,
         "reference_id": m.reference_id, "actor_id": m.actor_id,
         "occurred_at": m.occurred_at}
        for m in rows
    ]
