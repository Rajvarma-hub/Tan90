import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.container_types import CONTAINER_TYPES, resolve as resolve_type
from app.core.deps import get_current_user, require_roles, require_staff
from app.core.order_states import InvalidContainerTransition, check_container_transition
from app.db.session import get_db
from app.models.audit import AuditLog, ContainerMovement
from app.models.container import Container
from app.models.location import Location
from app.models.rfid import RFIDTag
from app.models.user import User
from app.models.dispatch import Dispatch
from app.models.packing import PackingSession
from app.services import container_view
from app.services.scan import resolve_scan
from app.schemas.container import (
    ContainerOut, ContainerRegisterRequest, ContainerUpdateRequest,
    ReplaceTagRequest, RestoreRequest, UnregisterRequest,
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
    return container_view.describe(db, [c])[0]


# Statuses in which a container is free of any order, so its record can be edited.
EDITABLE_STATUSES = {"AVAILABLE", "DAMAGED", "QUARANTINED", "MISSING"}
ASSET_ADMIN_ROLES = ("SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER")


def _require_own_station(user: User, c: Container) -> None:
    if user.role == "FREEZING_STATION_MANAGER" and user.location_id != c.current_location_id:
        raise HTTPException(403, "You can only manage containers at your own station")


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
    if c.status == "RETIRED":
        raise HTTPException(409, "Container is unregistered. Restore it with a new tag first")
    _require_own_station(user, c)

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


@router.patch("/{container_id}", response_model=ContainerOut)
def update_container(
    container_id: str,
    payload: ContainerUpdateRequest,
    user: User = Depends(require_roles(*ASSET_ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Correct the container type or move it to another location while it is off any order."""
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")
    _require_own_station(user, c)
    if c.status not in EDITABLE_STATUSES:
        raise HTTPException(409, "Container is on an order or retired. Edit it once it is back in stock")

    changes: dict[str, dict] = {}
    if payload.container_type_code is not None:
        try:
            type_name, capacity = resolve_type(payload.container_type_code)
        except KeyError:
            raise HTTPException(400, f"Unknown container type '{payload.container_type_code}'")
        if type_name != c.container_type:
            changes["container_type"] = {"from": c.container_type, "to": type_name}
            c.container_type = type_name
            c.capacity_litres = capacity

    if payload.location_id is not None and payload.location_id != c.current_location_id:
        if not db.get(Location, payload.location_id):
            raise HTTPException(404, "Location not found")
        db.add(ContainerMovement(
            container_id=c.id, from_status=c.status, to_status=c.status,
            from_location_id=c.current_location_id, to_location_id=payload.location_id,
            reason="RELOCATED", reference_type="CONTAINER", reference_id=c.id,
            actor_id=user.id,
        ))
        changes["location_id"] = {"from": c.current_location_id, "to": payload.location_id}
        c.current_location_id = payload.location_id

    if changes:
        db.add(AuditLog(
            entity_type="container", entity_id=c.id, action="CONTAINER_UPDATED",
            actor_id=user.id, details_json=json.dumps(changes),
        ))
    db.commit()
    return _container_dict(db, c)


@router.post("/{container_id}/unregister", response_model=ContainerOut)
def unregister_container(
    container_id: str,
    payload: UnregisterRequest,
    user: User = Depends(require_roles(*ASSET_ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Take a container out of circulation: its tags stop working and it leaves all counts."""
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")
    _require_own_station(user, c)
    try:
        check_container_transition(c.status, "RETIRED")
    except InvalidContainerTransition:
        raise HTTPException(409, "Container is on an order. Unregister it once it is back in stock")

    now = datetime.now(timezone.utc)
    old_epc = None
    for tag in db.query(RFIDTag).filter(
            RFIDTag.container_id == c.id, RFIDTag.active == True):  # noqa: E712
        old_epc = tag.epc
        tag.active = False
        tag.replaced_at = now

    db.add(ContainerMovement(
        container_id=c.id, from_status=c.status, to_status="RETIRED",
        from_location_id=c.current_location_id, to_location_id=c.current_location_id,
        reason="UNREGISTERED", reference_type="CONTAINER", reference_id=c.id,
        actor_id=user.id,
    ))
    db.add(AuditLog(
        entity_type="container", entity_id=c.id, action="CONTAINER_UNREGISTERED",
        actor_id=user.id,
        details_json=json.dumps({"epc": old_epc, "reason": payload.reason}),
    ))
    c.status = "RETIRED"
    c.current_customer_id = None
    db.commit()
    return _container_dict(db, c)


@router.post("/{container_id}/restore", response_model=ContainerOut)
def restore_container(
    container_id: str,
    payload: RestoreRequest,
    user: User = Depends(require_roles(*ASSET_ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Bring an unregistered container back into stock under a new tag."""
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")
    _require_own_station(user, c)
    if c.status != "RETIRED":
        raise HTTPException(409, "Container is not unregistered")
    if payload.location_id and not db.get(Location, payload.location_id):
        raise HTTPException(404, "Location not found")
    clash = db.query(RFIDTag).filter(
        RFIDTag.epc == payload.epc, RFIDTag.active == True  # noqa: E712
    ).first()
    if clash:
        raise HTTPException(409, f"EPC {payload.epc} already linked to container {clash.container_id}")

    db.add(RFIDTag(epc=payload.epc, container_id=c.id, active=True))
    db.add(ContainerMovement(
        container_id=c.id, from_status="RETIRED", to_status="AVAILABLE",
        from_location_id=c.current_location_id,
        to_location_id=payload.location_id or c.current_location_id,
        reason="RE_REGISTERED", reference_type="CONTAINER", reference_id=c.id,
        actor_id=user.id,
    ))
    db.add(AuditLog(
        entity_type="container", entity_id=c.id, action="CONTAINER_RESTORED",
        actor_id=user.id, details_json=json.dumps({"epc": payload.epc}),
    ))
    c.status = "AVAILABLE"
    if payload.location_id:
        c.current_location_id = payload.location_id
    db.commit()
    return _container_dict(db, c)


# ─── Read endpoints ────────────────────────────────────────────────

# Fixed paths MUST come before /{container_id} so FastAPI does not treat them as an ID.

@router.get("/summary")
def container_summary(user: User = Depends(require_staff),
                      db: Session = Depends(get_db)):
    """Counts by status, overall and per location — the 'what is in, what is out' view."""
    by_status: dict[str, int] = {}
    for status, count in db.query(
            Container.status, func.count(Container.id)).group_by(Container.status).all():
        by_status[status] = count
    return {
        "total": sum(n for s, n in by_status.items() if s != "RETIRED"),
        "by_status": by_status,
    }


@router.get("/lookup", response_model=ContainerOut)
def lookup_container(code: str, user: User = Depends(require_staff),
                     db: Session = Depends(get_db)):
    """Resolve a scan — RFID tag ID or the container code on the barcode label."""
    c = resolve_scan(db, code)
    if not c:
        raise HTTPException(404, f"No container matches '{code.strip()}'")
    return _container_dict(db, c)



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
    include_retired: bool = False,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    q = db.query(Container)
    if status:
        q = q.filter(Container.status == status)
    elif not include_retired:
        q = q.filter(Container.status != "RETIRED")
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
    return container_view.describe(db, rows)


@router.get("/{container_id}", response_model=ContainerOut)
def get_container(container_id: str, user: User = Depends(require_staff),
                  db: Session = Depends(get_db)):
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")
    return _container_dict(db, c)


@router.get("/{container_id}/history")
def container_history(container_id: str, user: User = Depends(require_staff),
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


@router.get("/{container_id}/detail")
def container_detail(container_id: str, user: User = Depends(require_staff),
                     db: Session = Depends(get_db)):
    """Container page: where it is, every order it has been on, and its movement log."""
    c = db.get(Container, container_id)
    if not c:
        raise HTTPException(404, "Container not found")

    locations = {loc.id: loc.code for loc in db.query(Location).all()}
    moves = db.query(ContainerMovement).filter(
        ContainerMovement.container_id == container_id
    ).order_by(ContainerMovement.occurred_at.desc()).all()
    actors = {
        u.id: u.full_name for u in db.query(User).filter(
            User.id.in_({m.actor_id for m in moves if m.actor_id})).all()
    }

    def order_of(m: ContainerMovement) -> str | None:
        if m.reference_type == "ORDER":
            return m.reference_id
        if m.reference_type == "PACKING_SESSION":
            ps = db.get(PackingSession, m.reference_id)
            return ps.order_id if ps else None
        if m.reference_type == "DISPATCH":
            d = db.get(Dispatch, m.reference_id)
            return d.order_id if d else None
        return None

    from app.models.order import Order
    history = []
    for m in moves:
        oid = order_of(m)
        o = db.get(Order, oid) if oid else None
        history.append({
            "id": m.id, "from_status": m.from_status, "to_status": m.to_status,
            "reason": m.reason,
            "from_location": locations.get(m.from_location_id),
            "to_location": locations.get(m.to_location_id),
            "order_id": o.id if o else None,
            "order_number": o.order_number if o else None,
            "actor_name": actors.get(m.actor_id),
            "occurred_at": m.occurred_at,
        })

    from app.models.customer import Customer
    orders = container_view.orders_by_container(db, [c.id]).get(c.id, [])
    customers = {cust.id: cust.name for cust in db.query(Customer).all()}
    return {
        **_container_dict(db, c),
        "created_at": c.created_at,
        "orders": [
            {"id": o.id, "order_number": o.order_number, "status": o.status,
             "customer_name": customers.get(o.customer_id),
             "created_at": o.created_at}
            for o in orders
        ],
        "history": history,
    }
