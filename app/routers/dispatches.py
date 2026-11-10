from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.states import InvalidTransition, validate_transition
from app.db.session import get_db
from app.models.audit import ContainerMovement
from app.models.container import Container
from app.models.delivery import DeliveryTask
from app.models.dispatch import Dispatch, DispatchItem
from app.models.order import Order
from app.models.packing import PackingSession
from app.models.rfid import RFIDTag
from app.models.user import User
from app.schemas.dispatch import (
    DispatchCreate, DispatchStatusUpdate, DispatchVerifyIn,
)

router = APIRouter(prefix="/api/dispatches", tags=["dispatches"])


def _move(db, container: Container, to_status: str, reason: str,
          ref_type: str, ref_id: str, actor_id: str) -> None:
    try:
        validate_transition(container.status, to_status)
    except InvalidTransition as e:
        raise HTTPException(409, str(e))
    db.add(ContainerMovement(
        container_id=container.id, from_status=container.status,
        to_status=to_status, reason=reason,
        reference_type=ref_type, reference_id=ref_id, actor_id=actor_id,
    ))
    container.status = to_status


@router.post("")
def create_dispatch(
    payload: DispatchCreate,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER")),
    db: Session = Depends(get_db),
):
    order = db.get(Order, payload.order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    session = db.get(PackingSession, payload.packing_session_id)
    if not session or session.order_id != order.id:
        raise HTTPException(400, "Packing session does not belong to this order")
    if session.status != "COMPLETED":
        raise HTTPException(409, "Packing session must be COMPLETED before dispatch")

    dispatch = Dispatch(
        order_id=order.id, packing_session_id=session.id,
        driver_id=payload.driver_id, vehicle_ref=payload.vehicle_ref, status="PENDING",
    )
    db.add(dispatch)
    db.flush()

    for item in session.items:
        db.add(DispatchItem(dispatch_id=dispatch.id, container_id=item.container_id))

    task = None
    if payload.driver_id:
        task = DeliveryTask(
            dispatch_id=dispatch.id, driver_id=payload.driver_id, status="ASSIGNED",
        )
        db.add(task)
        db.flush()

    db.commit()
    return {
        "id": dispatch.id,
        "status": dispatch.status,
        "order_id": dispatch.order_id,
        "task_id": task.id if task else None,
    }


@router.get("/{dispatch_id}")
def get_dispatch(
    dispatch_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    d = db.get(Dispatch, dispatch_id)
    if not d:
        raise HTTPException(404, "Dispatch not found")

    items = db.query(DispatchItem).filter(DispatchItem.dispatch_id == d.id).all()
    containers = []
    for di in items:
        c = db.get(Container, di.container_id)
        if not c:
            continue
        tag = db.query(RFIDTag).filter(
            RFIDTag.container_id == c.id, RFIDTag.active == True  # noqa: E712
        ).first()
        containers.append({
            "container_id": c.id, "container_code": c.container_code,
            "epc": tag.epc if tag else None, "status": c.status,
        })

    task = db.query(DeliveryTask).filter(DeliveryTask.dispatch_id == d.id).first()

    return {
        "id": d.id, "order_id": d.order_id, "status": d.status,
        "driver_id": d.driver_id, "vehicle_ref": d.vehicle_ref,
        "task_id": task.id if task else None,
        "containers": containers,
    }


@router.post("/{dispatch_id}/verify")
def verify_dispatch(
    dispatch_id: str,
    payload: DispatchVerifyIn,
    user: User = Depends(require_roles("DRIVER", "OPERATIONS_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
):
    """POC section 5: driver scans containers; system reports which match the manifest."""
    d = db.get(Dispatch, dispatch_id)
    if not d:
        raise HTTPException(404, "Dispatch not found")

    items = db.query(DispatchItem).filter(DispatchItem.dispatch_id == d.id).all()
    expected_container_ids = {i.container_id for i in items}

    matched, unexpected, unknown = [], [], []

    for epc in payload.epcs:
        tag = db.query(RFIDTag).filter(
            RFIDTag.epc == epc, RFIDTag.active == True  # noqa: E712
        ).first()
        if not tag:
            unknown.append(epc)
            continue
        if tag.container_id in expected_container_ids:
            matched.append({"epc": epc, "container_id": tag.container_id})
        else:
            unexpected.append({"epc": epc, "container_id": tag.container_id})

    matched_ids = {m["container_id"] for m in matched}
    missing = list(expected_container_ids - matched_ids)

    return {
        "dispatch_id": dispatch_id,
        "matched": matched,
        "missing_container_ids": missing,
        "unexpected": unexpected,
        "unknown_epcs": unknown,
        "expected_count": len(expected_container_ids),
        "scanned_count": len(payload.epcs),
    }


@router.post("/{dispatch_id}/status")
def update_dispatch_status(
    dispatch_id: str,
    payload: DispatchStatusUpdate,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER")),
    db: Session = Depends(get_db),
):
    d = db.get(Dispatch, dispatch_id)
    if not d:
        raise HTTPException(404, "Dispatch not found")

    if payload.status == "DISPATCHED":
        if d.status != "PENDING":
            raise HTTPException(409, f"Dispatch is {d.status}")
        items = db.query(DispatchItem).filter(DispatchItem.dispatch_id == d.id).all()
        if not items:
            raise HTTPException(400, "No containers on this dispatch")

        for di in items:
            container = db.get(Container, di.container_id)
            _move(db, container, "IN_TRANSIT_TO_CUSTOMER", "DISPATCHED",
                  "DISPATCH", d.id, user.id)

        d.status = "DISPATCHED"
        d.confirmed_at = datetime.now(timezone.utc)
        order = db.get(Order, d.order_id)
        order.status = "DISPATCHED"

    elif payload.status == "CANCELLED":
        d.status = "CANCELLED"
    else:
        raise HTTPException(400, f"Unknown status {payload.status}")

    db.commit()
    return {"id": d.id, "status": d.status}
