"""Central orchestrator. Every order state change goes through here."""
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.order_states import (
    OrderStatus, check_order_transition, check_container_transition,
    InvalidOrderTransition, InvalidContainerTransition,
)
from app.models.audit import ContainerMovement, ExceptionRecord
from app.models.container import Container
from app.models.delivery import DeliveryTask
from app.models.dispatch import Dispatch, DispatchItem
from app.models.order import Order
from app.models.order_event import OrderEvent
from app.models.packing import PackingItem, PackingSession
from app.models.qr import QRToken
from app.models.rfid import RFIDTag
from app.models.user import User
from app.services import inventory as inventory_service
from app.services import notifications as notif


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _record_event(db: Session, order: Order, action: str, frm: str, to: str,
                  actor: User, notes: str | None = None) -> None:
    db.add(OrderEvent(
        order_id=order.id, action=action, from_status=frm, to_status=to,
        actor_id=actor.id, notes=notes,
    ))


def _transition(db: Session, order: Order, action: str, actor: User,
                notes: str | None = None) -> None:
    """Validate, apply, and record a transition. Raises 409 if illegal."""
    frm = order.status
    try:
        to = check_order_transition(action, frm)
    except InvalidOrderTransition as e:
        raise HTTPException(409, str(e))
    order.status = to
    _record_event(db, order, action, frm, to, actor, notes)


def _move_container(db: Session, c: Container, to_status: str, reason: str,
                    ref_type: str, ref_id: str, actor_id: str,
                    customer_id: str | None = None,
                    location_id: str | None = None) -> None:
    try:
        check_container_transition(c.status, to_status)
    except InvalidContainerTransition as e:
        raise HTTPException(409, str(e))
    db.add(ContainerMovement(
        container_id=c.id, from_status=c.status, to_status=to_status,
        from_location_id=c.current_location_id, to_location_id=location_id or c.current_location_id,
        reason=reason, reference_type=ref_type, reference_id=ref_id,
        actor_id=actor_id,
    ))
    c.status = to_status
    if customer_id is not None:
        c.current_customer_id = customer_id
    if location_id is not None:
        c.current_location_id = location_id


# ─── helpers ────────────────────────────────────────────────────

def _containers_for_order(db: Session, order_id: str) -> list[Container]:
    items = db.query(DispatchItem).join(
        Dispatch, Dispatch.id == DispatchItem.dispatch_id
    ).filter(Dispatch.order_id == order_id).all()
    return [db.get(Container, i.container_id) for i in items if db.get(Container, i.container_id)]


def _packing_containers_for_order(db: Session, order_id: str) -> list[Container]:
    """Containers in the most recent packing session for this order."""
    session = db.query(PackingSession).filter(
        PackingSession.order_id == order_id
    ).order_by(PackingSession.created_at.desc()).first()
    if not session:
        return []
    items = db.query(PackingItem).filter(PackingItem.session_id == session.id).all()
    return [db.get(Container, i.container_id) for i in items if db.get(Container, i.container_id)]


def _require_station_owner(order: Order, user: User) -> None:
    """FSM/Worker must belong to the order's station."""
    if user.role in ("FREEZING_STATION_MANAGER", "PACKING_WORKER"):
        if user.location_id != order.station_id:
            raise HTTPException(403, "Order is at a different station")


def _require_driver_owner(order: Order, user: User, field: str = "driver_id") -> None:
    if user.role == "DRIVER" and getattr(order, field) != user.id:
        raise HTTPException(403, "Not your assignment")


# ─── PUBLIC ACTIONS ─────────────────────────────────────────────

def create_order(db: Session, *, customer_id: str, station_id: str | None,
                 destination: str | None, expected_delivery_at: datetime | None,
                 items: list[dict], actor: User) -> Order:
    from app.models.order import OrderItem
    from app.models.product import Product
    from app.models.customer import Customer
    from sqlalchemy import func

    if actor.role == "CUSTOMER" and actor.customer_id != customer_id:
        raise HTTPException(403, "Customers can only create their own orders")
    if not db.get(Customer, customer_id):
        raise HTTPException(404, "Customer not found")
    for it in items:
        if not db.get(Product, it["product_id"]):
            raise HTTPException(404, f"Product {it['product_id']} not found")

    count = db.query(func.count(Order.id)).scalar() or 0
    order = Order(
        order_number=f"ORD-{count + 1:04d}",
        customer_id=customer_id,
        station_id=station_id,
        destination=destination,
        expected_delivery_at=expected_delivery_at,
        status=OrderStatus.PENDING_OPS_APPROVAL,
        created_by=actor.id,
    )
    db.add(order)
    db.flush()
    for it in items:
        db.add(OrderItem(order_id=order.id, product_id=it["product_id"], quantity=it["quantity"]))

    notif.notify_role(db, "OPERATIONS_ADMIN", kind="ORDER_CREATED",
                      title=f"Order {order.order_number} needs approval",
                      body=f"Customer {customer_id} created an order",
                      reference_type="order", reference_id=order.id)

    _record_event(db, order, "create", "—", order.status, actor)
    db.commit()
    db.refresh(order)
    return order


def approve_order(db: Session, order_id: str, *, station_id: str, actor: User) -> Order:
    if actor.role not in ("SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Only Ops/Admin can approve")

    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    order.station_id = station_id
    order.approved_by = actor.id
    order.approved_at = _now()
    _transition(db, order, "approve", actor)

    # notify FSM + workers at that station
    notif.notify_role(db, "FREEZING_STATION_MANAGER", location_id=station_id,
                      kind="ORDER_APPROVED",
                      title=f"Order {order.order_number} approved",
                      body="Ready to pack",
                      reference_type="order", reference_id=order.id)
    notif.notify_role(db, "PACKING_WORKER", location_id=station_id,
                      kind="ORDER_APPROVED",
                      title=f"Order {order.order_number} approved",
                      body="Ready to pack",
                      reference_type="order", reference_id=order.id)
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: str, actor: User) -> Order:
    """Ops can cancel before packing starts, so no containers or stock are involved."""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _transition(db, order, "cancel", actor)
    db.commit()
    db.refresh(order)
    return order


def start_packing(db: Session, order_id: str, actor: User) -> PackingSession:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_station_owner(order, actor)
    if actor.role not in ("FREEZING_STATION_MANAGER", "PACKING_WORKER",
                          "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    existing = db.query(PackingSession).filter(
        PackingSession.order_id == order_id, PackingSession.status == "OPEN"
    ).first()
    if existing:
        raise HTTPException(409, f"Active session exists: {existing.id}")

    session = PackingSession(
        order_id=order_id, station_id=order.station_id,
        status="OPEN", opened_by=actor.id,
    )
    db.add(session)
    order.packing_started_at = _now()
    _transition(db, order, "start_packing", actor)
    db.commit()
    db.refresh(session)
    return session


def complete_packing(db: Session, session_id: str, actor: User) -> Order:
    session = db.get(PackingSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    order = db.get(Order, session.order_id)
    _require_station_owner(order, actor)
    if actor.role not in ("FREEZING_STATION_MANAGER", "PACKING_WORKER",
                          "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")
    if session.status != "OPEN":
        raise HTTPException(409, f"Session is {session.status}")
    if not session.items:
        raise HTTPException(400, "No containers in session")

    for item in session.items:
        if not json.loads(item.contents_json):
            raise HTTPException(400, f"Container {item.container_id} has no contents")
        c = db.get(Container, item.container_id)
        _move_container(db, c, "PACKED", "PACKING_COMPLETED",
                        "PACKING_SESSION", session.id, actor.id)

    session.status = "COMPLETED"
    session.completed_at = _now()
    order.packed_at = _now()
    _transition(db, order, "complete_packing", actor)

    notif.notify_role(db, "OPERATIONS_ADMIN", kind="ORDER_PACKED",
                      title=f"Order {order.order_number} packed",
                      body="Ready for dispatch",
                      reference_type="order", reference_id=order.id)
    db.commit()
    db.refresh(order)
    return order


def dispatch_order(db: Session, order_id: str, *, driver_id: str, vehicle_ref: str,
                   epcs: list[str], actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_station_owner(order, actor)
    if actor.role not in ("FREEZING_STATION_MANAGER", "PACKING_WORKER",
                          "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    driver = db.get(User, driver_id)
    if not driver or driver.role != "DRIVER":
        raise HTTPException(400, "Invalid driver")

    packed = _packing_containers_for_order(db, order_id)
    if not packed:
        raise HTTPException(409, "No packed containers to dispatch")

    expected_epcs = set()
    for c in packed:
        tag = db.query(RFIDTag).filter(
            RFIDTag.container_id == c.id, RFIDTag.active == True).first()  # noqa: E712
        if tag:
            expected_epcs.add(tag.epc)

    observed = set(epcs)
    if observed != expected_epcs:
        missing = list(expected_epcs - observed)
        unexpected = list(observed - expected_epcs)
        raise HTTPException(400, {
            "message": "Scan does not match packing manifest",
            "missing_epcs": missing,
            "unexpected_epcs": unexpected,
        })

    dispatch = Dispatch(
        order_id=order.id, packing_session_id=None,
        driver_id=driver_id, vehicle_ref=vehicle_ref,
        status="DISPATCHED", confirmed_at=_now(),
    )
    # find most recent completed session
    session = db.query(PackingSession).filter(
        PackingSession.order_id == order_id, PackingSession.status == "COMPLETED"
    ).order_by(PackingSession.completed_at.desc()).first()
    if session:
        dispatch.packing_session_id = session.id
    db.add(dispatch)
    db.flush()

    for c in packed:
        db.add(DispatchItem(dispatch_id=dispatch.id, container_id=c.id))
        _move_container(db, c, "IN_TRANSIT_TO_CUSTOMER", "DISPATCHED",
                        "DISPATCH", dispatch.id, actor.id)

    # Ordered panels leave the station's stock when the vehicle is loaded.
    if order.station_id:
        for item in order.items:
            inventory_service.apply_movement(
                db, product_id=item.product_id, location_id=order.station_id,
                delta=-item.quantity, reason="SALES",
                reference_type="ORDER", reference_id=order.id, actor_id=actor.id)

    task = DeliveryTask(dispatch_id=dispatch.id, driver_id=driver_id, status="ASSIGNED")
    db.add(task)

    order.driver_id = driver_id
    order.dispatched_at = _now()
    _transition(db, order, "dispatch", actor)

    notif.notify_user(db, driver_id, kind="DRIVER_ASSIGNED",
                      title=f"You have a delivery: {order.order_number}",
                      body=f"Pick up from {order.station_id}",
                      reference_type="order", reference_id=order.id)
    notif.notify_role(db, "OPERATIONS_ADMIN", kind="ORDER_DISPATCHED",
                      title=f"Order {order.order_number} dispatched",
                      body=f"Driver {driver_id}",
                      reference_type="order", reference_id=order.id)

    db.commit()
    db.refresh(order)
    return order


def depart(db: Session, order_id: str, actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_driver_owner(order, actor)
    if actor.role not in ("DRIVER", "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    order.in_transit_at = _now()
    _transition(db, order, "depart", actor)

    task = db.query(DeliveryTask).filter(
        DeliveryTask.dispatch_id.in_(
            db.query(Dispatch.id).filter(Dispatch.order_id == order_id))
    ).order_by(DeliveryTask.created_at.desc()).first()
    if task and task.status in ("ASSIGNED", "DEPARTED"):
        task.status = "DEPARTED"
        task.departed_at = _now()

    db.commit()
    db.refresh(order)
    return order


def arrive(db: Session, order_id: str, actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_driver_owner(order, actor)
    if actor.role not in ("DRIVER", "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    order.arrived_at = _now()
    _transition(db, order, "arrive", actor)

    task = db.query(DeliveryTask).filter(
        DeliveryTask.dispatch_id.in_(
            db.query(Dispatch.id).filter(Dispatch.order_id == order_id))
    ).order_by(DeliveryTask.created_at.desc()).first()
    if task and task.status in ("DEPARTED", "ARRIVED"):
        task.status = "ARRIVED"
        task.arrived_at = _now()

    # generate QR token for customer
    raw = secrets.token_urlsafe(32)
    db.add(QRToken(
        order_id=order_id, token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        expires_at=_now() + timedelta(hours=24),
    ))

    # notify customer with the raw token in the message (in production this would be a link)
    notif.notify_user(db, _customer_user_id(db, order.customer_id), kind="DELIVERY_ARRIVED",
                      title=f"Your delivery {order.order_number} has arrived",
                      body=f"Open your portal and verify containers. QR token: {raw[:8]}...",
                      reference_type="order", reference_id=order.id)

    db.commit()
    db.refresh(order)
    return order


def deliver(db: Session, order_id: str, actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_driver_owner(order, actor)
    if actor.role not in ("DRIVER", "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    order.delivered_at = _now()
    _transition(db, order, "deliver", actor)
    db.commit()
    db.refresh(order)
    return order


def _customer_user_id(db: Session, customer_id: str) -> str | None:
    """First CUSTOMER user for a given customer_id."""
    u = db.query(User).filter(
        User.customer_id == customer_id, User.role == "CUSTOMER"
    ).first()
    return u.id if u else None


def verify_qr(db: Session, order_id: str, raw_token: str, actor: User) -> Order:
    """Customer scans QR — validates token, returns order with expected containers."""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if actor.role != "CUSTOMER" or actor.customer_id != order.customer_id:
        raise HTTPException(403, "Not your order")

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    qr = db.query(QRToken).filter(
        QRToken.order_id == order_id, QRToken.token_hash == token_hash,
    ).first()
    if not qr:
        raise HTTPException(401, "Invalid QR token")
    if qr.expires_at < _now():
        raise HTTPException(401, "QR token expired")
    if qr.used_at:
        raise HTTPException(409, "QR token already used")

    qr.used_at = _now()
    qr.used_by_user_id = actor.id
    db.commit()
    return order


def confirm_receipt(db: Session, order_id: str, *, received: list[str],
                    missing: list[str], damaged: list[str], notes: str | None,
                    actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    # Ops/Admin may confirm on the customer's behalf (e.g. signed paper POD).
    if actor.role == "CUSTOMER":
        if actor.customer_id != order.customer_id:
            raise HTTPException(403, "Not your order")
    elif actor.role not in ("SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    all_expected = {c.id for c in _containers_for_order(db, order_id)}
    reported = set(received) | set(missing) | set(damaged)
    if reported != all_expected:
        raise HTTPException(400, {
            "message": "Report must cover every expected container",
            "expected": list(all_expected),
            "reported": list(reported),
        })

    has_issue = bool(missing or damaged)

    for cid in received:
        c = db.get(Container, cid)
        _move_container(db, c, "WITH_CUSTOMER", "CUSTOMER_CONFIRMED_RECEIPT",
                        "ORDER", order.id, actor.id, customer_id=order.customer_id)
    for cid in damaged:
        c = db.get(Container, cid)
        _move_container(db, c, "WITH_CUSTOMER", "CUSTOMER_REPORTED_DAMAGE",
                        "ORDER", order.id, actor.id, customer_id=order.customer_id)
        db.add(ExceptionRecord(
            kind="DAMAGED_ON_DELIVERY", severity="WARNING", status="OPEN",
            reference_type="ORDER", reference_id=order.id,
            details_json=json.dumps({"container_id": cid}),
        ))
    for cid in missing:
        db.add(ExceptionRecord(
            kind="MISSING_ON_DELIVERY", severity="CRITICAL", status="OPEN",
            reference_type="ORDER", reference_id=order.id,
            details_json=json.dumps({"container_id": cid}),
        ))

    order.customer_confirmed_at = _now()
    if has_issue:
        _transition(db, order, "dispute", actor, notes=notes)
        notif.notify_role(db, "OPERATIONS_ADMIN", kind="DELIVERY_DISPUTED",
                          title=f"Order {order.order_number} disputed",
                          body=f"Missing: {len(missing)}, Damaged: {len(damaged)}",
                          reference_type="order", reference_id=order.id)
    else:
        _transition(db, order, "confirm", actor, notes=notes)
        notif.notify_role(db, "OPERATIONS_ADMIN", kind="DELIVERY_CONFIRMED",
                          title=f"Order {order.order_number} confirmed",
                          body="Customer confirmed receipt",
                          reference_type="order", reference_id=order.id)

    db.commit()
    db.refresh(order)
    return order


def request_return(db: Session, order_id: str, container_ids: list[str],
                   actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if actor.role == "CUSTOMER" and actor.customer_id != order.customer_id:
        raise HTTPException(403, "Not your order")

    for cid in container_ids:
        c = db.get(Container, cid)
        if not c or c.current_customer_id != order.customer_id:
            raise HTTPException(400, f"Container {cid} not with this customer")
        _move_container(db, c, "RETURN_REQUESTED", "CUSTOMER_REQUESTED_RETURN",
                        "ORDER", order.id, actor.id)

    order.return_requested_at = _now()
    _transition(db, order, "request_return", actor)

    # notify Ops, FSM, and all drivers
    notif.notify_role(db, "OPERATIONS_ADMIN", kind="RETURN_REQUESTED",
                      title=f"Return requested: {order.order_number}",
                      body=f"{len(container_ids)} containers",
                      reference_type="order", reference_id=order.id)
    if order.station_id:
        notif.notify_role(db, "FREEZING_STATION_MANAGER", location_id=order.station_id,
                          kind="RETURN_REQUESTED",
                          title=f"Return expected: {order.order_number}",
                          body="Driver will bring containers to your station",
                          reference_type="order", reference_id=order.id)
    notif.notify_role(db, "DRIVER", kind="RETURN_AVAILABLE",
                      title=f"Return available: {order.order_number}",
                      body=f"{len(container_ids)} containers waiting",
                      reference_type="order", reference_id=order.id)

    db.commit()
    db.refresh(order)
    return order


def assign_return_driver(db: Session, order_id: str, driver_id: str,
                         actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if actor.role == "FREEZING_STATION_MANAGER" and actor.location_id != order.station_id:
        raise HTTPException(403, "Not your station")
    if actor.role not in ("FREEZING_STATION_MANAGER", "OPERATIONS_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(403, "Not allowed")

    driver = db.get(User, driver_id)
    if not driver or driver.role != "DRIVER":
        raise HTTPException(400, "Invalid driver")

    order.return_driver_id = driver_id
    notif.notify_user(db, driver_id, kind="RETURN_ASSIGNED",
                      title=f"Pickup assigned: {order.order_number}",
                      body=f"Collect from customer {order.customer_id}",
                      reference_type="order", reference_id=order.id)
    db.commit()
    db.refresh(order)
    return order


def collect_return(db: Session, order_id: str, epcs: list[str], actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if actor.role == "DRIVER" and order.return_driver_id != actor.id:
        raise HTTPException(403, "Not your pickup")

    containers = _containers_for_order(db, order_id)
    expected_epcs = {}
    for c in containers:
        if not c or c.status != "RETURN_REQUESTED":
            continue
        tag = db.query(RFIDTag).filter(
            RFIDTag.container_id == c.id, RFIDTag.active == True).first()  # noqa: E712
        if tag:
            expected_epcs[tag.epc] = c

    observed = set(epcs)
    missing = list(set(expected_epcs) - observed)
    unexpected = list(observed - set(expected_epcs))
    if missing or unexpected:
        raise HTTPException(400, {
            "message": "Scan does not match return request",
            "missing_epcs": missing,
            "unexpected_epcs": unexpected,
        })

    for epc, c in expected_epcs.items():
        _move_container(db, c, "IN_TRANSIT_TO_STATION", "RETURN_COLLECTED",
                        "ORDER", order.id, actor.id, customer_id=None)

    order.return_collected_at = _now()
    _transition(db, order, "collect_return", actor)

    if order.station_id:
        notif.notify_role(db, "FREEZING_STATION_MANAGER", location_id=order.station_id,
                          kind="RETURN_INBOUND",
                          title=f"Return inbound: {order.order_number}",
                          body="Driver is bringing containers",
                          reference_type="order", reference_id=order.id)

    db.commit()
    db.refresh(order)
    return order


def receive_return(db: Session, order_id: str, actor: User) -> Order:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_station_owner(order, actor)
    if actor.role not in ("FREEZING_STATION_MANAGER", "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    order.return_received_at = _now()
    _transition(db, order, "receive_return", actor)
    db.commit()
    db.refresh(order)
    return order


def inspect_and_close(db: Session, order_id: str, results: list[dict],
                      actor: User) -> Order:
    """results: [{container_id, condition (OK|DAMAGED|CONTAMINATED), notes}]"""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_station_owner(order, actor)
    if actor.role not in ("FREEZING_STATION_MANAGER", "SUPER_ADMIN", "OPERATIONS_ADMIN"):
        raise HTTPException(403, "Not allowed")

    from app.models.returns import ReturnInspection

    any_bad = False
    for r in results:
        c = db.get(Container, r["container_id"])
        if not c or c.status != "IN_TRANSIT_TO_STATION":
            raise HTTPException(400, f"Container {r['container_id']} not ready for inspection")

        db.add(ReturnInspection(
            return_id=order.id, container_id=c.id,  # note: ReturnInspection.return_id is now order_id
            condition=r["condition"], contains_panels=r.get("contains_panels", False),
            notes=r.get("notes"), inspected_by=actor.id,
        ))
        _move_container(db, c, "UNDER_INSPECTION", "STATION_RECEIVED",
                        "ORDER", order.id, actor.id)
        final = (
            "AVAILABLE" if r["condition"] == "OK"
            else "DAMAGED" if r["condition"] == "DAMAGED"
            else "QUARANTINED"
        )
        _move_container(db, c, final, f"INSPECTION_{r['condition']}",
                        "ORDER", order.id, actor.id, location_id=order.station_id)
        if r["condition"] != "OK":
            any_bad = True

    if not any_bad:
        order.closed_at = _now()
        _transition(db, order, "close", actor)
        notif.notify_role(db, "OPERATIONS_ADMIN", kind="ORDER_CLOSED",
                          title=f"Order {order.order_number} closed",
                          body="All containers inspected cleanly",
                          reference_type="order", reference_id=order.id)

    db.commit()
    db.refresh(order)
    return order
