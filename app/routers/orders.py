import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.container import Container
from app.models.delivery import DeliveryTask
from app.models.dispatch import Dispatch, DispatchItem
from app.models.order import Order
from app.models.order_event import OrderEvent
from app.models.packing import PackingItem, PackingSession
from app.models.rfid import RFIDTag
from app.models.user import User
from app.schemas.order import OrderCreate, OrderOut
from app.schemas.order_flow import (
    ApproveIn, ConfirmReceiptIn, DispatchIn, RequestReturnIn,
    VerifyQRIn, AssignReturnDriverIn, CollectReturnIn, InspectAndCloseIn,
)
from app.services import order_flow

router = APIRouter(prefix="/api/orders", tags=["orders"])


# ─── Create / read ─────────────────────────────────────────────

@router.post("", response_model=OrderOut)
def create_order(
    payload: OrderCreate,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN", "CUSTOMER")),
    db: Session = Depends(get_db),
):
    return order_flow.create_order(
        db, customer_id=payload.customer_id, station_id=payload.station_id,
        destination=payload.destination,
        expected_delivery_at=payload.expected_delivery_at,
        items=[{"product_id": i.product_id, "quantity": i.quantity} for i in payload.items],
        actor=user,
    )


@router.get("", response_model=list[OrderOut])
def list_orders(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    if user.role == "CUSTOMER":
        q = q.filter(Order.customer_id == user.customer_id)
    elif user.role in ("FREEZING_STATION_MANAGER", "PACKING_WORKER"):
        q = q.filter(Order.station_id == user.location_id)
    if status:
        q = q.filter(Order.status == status)
    return q.order_by(Order.created_at.desc()).all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if user.role == "CUSTOMER" and order.customer_id != user.customer_id:
        raise HTTPException(403, "Access denied")
    return order


@router.get("/{order_id}/history")
def order_history(order_id: str, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if user.role == "CUSTOMER" and order.customer_id != user.customer_id:
        raise HTTPException(403, "Access denied")
    rows = db.query(OrderEvent).filter(
        OrderEvent.order_id == order_id
    ).order_by(OrderEvent.occurred_at).all()
    return [
        {"id": r.id, "action": r.action, "from": r.from_status,
         "to": r.to_status, "actor_id": r.actor_id,
         "notes": r.notes, "occurred_at": r.occurred_at}
        for r in rows
    ]


# ─── Actions ────────────────────────────────────────────────────

@router.post("/{order_id}/approve")
def approve(order_id: str, payload: ApproveIn,
            user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
            db: Session = Depends(get_db)):
    return order_flow.approve_order(db, order_id, station_id=payload.station_id, actor=user)


@router.post("/{order_id}/depart")
def depart(order_id: str,
           user: User = Depends(require_roles("DRIVER", "SUPER_ADMIN", "OPERATIONS_ADMIN")),
           db: Session = Depends(get_db)):
    return order_flow.depart(db, order_id, user)


@router.post("/{order_id}/arrive")
def arrive(order_id: str,
           user: User = Depends(require_roles("DRIVER", "SUPER_ADMIN", "OPERATIONS_ADMIN")),
           db: Session = Depends(get_db)):
    return order_flow.arrive(db, order_id, user)


@router.post("/{order_id}/deliver")
def deliver(order_id: str,
            user: User = Depends(require_roles("DRIVER", "SUPER_ADMIN", "OPERATIONS_ADMIN")),
            db: Session = Depends(get_db)):
    return order_flow.deliver(db, order_id, user)


@router.post("/{order_id}/verify")
def verify_qr(order_id: str, payload: VerifyQRIn,
              user: User = Depends(require_roles("CUSTOMER")),
              db: Session = Depends(get_db)):
    order = order_flow.verify_qr(db, order_id, payload.token, user)
    containers = order_flow._containers_for_order(db, order_id)
    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "containers": [
            {"container_id": c.id, "container_code": c.container_code, "status": c.status}
            for c in containers
        ],
    }


@router.post("/{order_id}/confirm-receipt")
def confirm_receipt(order_id: str, payload: ConfirmReceiptIn,
                    user: User = Depends(require_roles("CUSTOMER")),
                    db: Session = Depends(get_db)):
    return order_flow.confirm_receipt(
        db, order_id, received=payload.received, missing=payload.missing,
        damaged=payload.damaged, notes=payload.notes, actor=user,
    )


@router.post("/{order_id}/dispatch")
def dispatch_order(order_id: str, payload: DispatchIn,
                   user: User = Depends(require_roles(
                       "FREEZING_STATION_MANAGER", "PACKING_WORKER",
                       "SUPER_ADMIN", "OPERATIONS_ADMIN")),
                   db: Session = Depends(get_db)):
    return order_flow.dispatch_order(
        db, order_id, driver_id=payload.driver_id,
        vehicle_ref=payload.vehicle_ref, epcs=payload.epcs, actor=user,
    )


@router.post("/{order_id}/returns")
def request_return(order_id: str, payload: RequestReturnIn,
                   user: User = Depends(require_roles("CUSTOMER", "SUPER_ADMIN", "OPERATIONS_ADMIN")),
                   db: Session = Depends(get_db)):
    return order_flow.request_return(db, order_id, payload.container_ids, user)


@router.post("/{order_id}/returns/assign-driver")
def assign_return_driver(order_id: str, payload: AssignReturnDriverIn,
                         user: User = Depends(require_roles(
                             "FREEZING_STATION_MANAGER", "OPERATIONS_ADMIN", "SUPER_ADMIN")),
                         db: Session = Depends(get_db)):
    return order_flow.assign_return_driver(db, order_id, payload.driver_id, user)


@router.post("/{order_id}/returns/collect")
def collect_return(order_id: str, payload: CollectReturnIn,
                   user: User = Depends(require_roles("DRIVER", "OPERATIONS_ADMIN", "SUPER_ADMIN")),
                   db: Session = Depends(get_db)):
    return order_flow.collect_return(db, order_id, payload.epcs, user)


@router.post("/{order_id}/returns/receive")
def receive_return(order_id: str,
                   user: User = Depends(require_roles(
                       "FREEZING_STATION_MANAGER", "OPERATIONS_ADMIN", "SUPER_ADMIN")),
                   db: Session = Depends(get_db)):
    return order_flow.receive_return(db, order_id, user)


@router.post("/{order_id}/returns/inspect")
def inspect_and_close(order_id: str, payload: InspectAndCloseIn,
                      user: User = Depends(require_roles(
                          "FREEZING_STATION_MANAGER", "OPERATIONS_ADMIN", "SUPER_ADMIN")),
                      db: Session = Depends(get_db)):
    results = [r.model_dump() for r in payload.results]
    return order_flow.inspect_and_close(db, order_id, results, user)


# ─── Legacy read helpers ────────────────────────────────────────

@router.get("/{order_id}/manifest")
def get_manifest(order_id: str, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if user.role == "CUSTOMER" and order.customer_id != user.customer_id:
        raise HTTPException(403, "Access denied")
    session = db.query(PackingSession).filter(
        PackingSession.order_id == order_id
    ).order_by(PackingSession.created_at.desc()).first()
    if not session:
        return {"order_id": order_id, "session": None, "containers": []}
    items = db.query(PackingItem).filter(PackingItem.session_id == session.id).all()
    out = []
    for it in items:
        c = db.get(Container, it.container_id)
        if not c:
            continue
        tag = db.query(RFIDTag).filter(
            RFIDTag.container_id == c.id, RFIDTag.active == True).first()  # noqa: E712
        out.append({
            "container_id": c.id, "container_code": c.container_code,
            "epc": tag.epc if tag else None, "contents": json.loads(it.contents_json),
        })
    return {
        "order_id": order.id, "order_number": order.order_number,
        "customer_id": order.customer_id,
        "session": {"id": session.id, "status": session.status},
        "containers": out,
    }
