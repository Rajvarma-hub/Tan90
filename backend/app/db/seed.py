"""Rich seed — 15 orders across every lifecycle state.

Every role sees realistic data on login:
  Customer  → own orders in various states, containers in custody, returns
  Driver    → assigned tasks in flight, return pickups
  Ops       → pending approvals, disputed orders, all activity
  FSM       → work queue, inbound returns
  Packer    → orders to pack, containers to register
  Admin     → full dashboard with data in every status

Idempotent: no-op if users already exist.
"""
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.core.container_types import CONTAINER_TYPES
from app.core.security import hash_password
from app.db.base import init_schema
from app.db.session import SessionLocal
from app.models.audit import AuditLog, ContainerMovement, ExceptionRecord
from app.models.container import Container
from app.models.customer import Customer
from app.models.delivery import DeliveryTask, GPSEvent
from app.models.dispatch import Dispatch, DispatchItem
from app.models.inventory import InventoryBalance, InventoryMovement
from app.models.location import Location
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.order_event import OrderEvent
from app.models.packing import PackingItem, PackingSession
from app.models.product import Product
from app.models.qr import QRToken
from app.models.returns import ReturnInspection, ReturnRequest
from app.models.rfid import RFIDTag
from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ago(days: float = 0, minutes: float = 0) -> datetime:
    return utcnow() - timedelta(days=days, minutes=minutes)


def epc_for(n: int) -> str:
    return f"E280A1{n:018d}"


# ═══════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════

def _oe(db: Session, order: Order, action: str, frm: str, to: str,
        actor: str, at: datetime, notes: str | None = None) -> None:
    db.add(OrderEvent(order_id=order.id, action=action,
                      from_status=frm, to_status=to,
                      actor_id=actor, notes=notes, occurred_at=at))


def _al(db: Session, entity_type: str, entity_id: str, action: str,
        actor: str, at: datetime, details: dict | None = None) -> None:
    db.add(AuditLog(entity_type=entity_type, entity_id=entity_id,
                    action=action, actor_id=actor,
                    details_json=json.dumps(details) if details else None,
                    occurred_at=at))


def _cm(db: Session, c: Container, to: str, reason: str,
        ref_type: str, ref_id: str, actor: str, at: datetime,
        customer_id: str | None = None, location_id: str | None = None) -> None:
    db.add(ContainerMovement(
        container_id=c.id, from_status=c.status, to_status=to,
        from_location_id=c.current_location_id,
        to_location_id=location_id or c.current_location_id,
        reason=reason, reference_type=ref_type, reference_id=ref_id,
        actor_id=actor, occurred_at=at,
    ))
    c.status = to
    if customer_id is not None:
        c.current_customer_id = customer_id
    if location_id is not None:
        c.current_location_id = location_id


def _notif_user(db: Session, user_id: str, kind: str, title: str,
                body: str, ref_type: str, ref_id: str, at: datetime) -> None:
    db.add(Notification(recipient_user_id=user_id, kind=kind,
                        title=title, body=body,
                        reference_type=ref_type, reference_id=ref_id,
                        created_at=at))


def _notif_role(db: Session, role: str, kind: str, title: str, body: str,
                ref_type: str, ref_id: str, at: datetime,
                location_id: str | None = None) -> None:
    db.add(Notification(recipient_role=role,
                        recipient_location_id=location_id,
                        kind=kind, title=title, body=body,
                        reference_type=ref_type, reference_id=ref_id,
                        created_at=at))


def _stock(db: Session, product_id: str, location_id: str, delta: int,
           reason: str, ref_type: str, ref_id: str, actor: str,
           at: datetime) -> None:
    """Mirror of services.inventory.apply_movement with a backdated timestamp."""
    bal = db.query(InventoryBalance).filter_by(
        product_id=product_id, location_id=location_id).first()
    if bal is None:
        bal = InventoryBalance(product_id=product_id, location_id=location_id,
                               quantity=0)
        db.add(bal)
        db.flush()
    bal.quantity += delta
    assert bal.quantity >= 0, f"seed would drive {product_id}@{location_id} negative"
    db.add(InventoryMovement(
        product_id=product_id, location_id=location_id, delta=delta,
        reason=reason, reference_type=ref_type, reference_id=ref_id,
        actor_id=actor, occurred_at=at,
    ))


def _transfer(db: Session, product_id: str, src: str, dst: str, qty: int,
              actor: str, at: datetime) -> None:
    _stock(db, product_id, src, -qty, "INTERNAL_TRANSFER", "LOCATION", dst, actor, at)
    _stock(db, product_id, dst, qty, "INTERNAL_TRANSFER", "LOCATION", src, actor, at)


# ═══════════════════════════════════════════════════════════════════════
#  Pipeline helpers
# ═══════════════════════════════════════════════════════════════════════

def step_approve(db, order, actor, station_id, at):
    order.station_id = station_id
    order.approved_by = actor
    order.approved_at = at
    order.status = "APPROVED"
    _oe(db, order, "approve", "PENDING_OPS_APPROVAL", "APPROVED", actor, at)
    _al(db, "order", order.id, "ORDER_APPROVED", actor, at)


def step_start_packing(db, order, actor, at):
    sess = PackingSession(order_id=order.id, station_id=order.station_id,
                          status="OPEN", opened_by=actor, created_at=at)
    db.add(sess)
    db.flush()
    order.status = "PACKING"
    order.packing_started_at = at
    _oe(db, order, "start_packing", "APPROVED", "PACKING", actor, at)
    return sess


def step_scan(db, order, sess, containers_and_contents, actor, at):
    for c, contents in containers_and_contents:
        _cm(db, c, "PACKING", "PACKING_STARTED",
            "PACKING_SESSION", sess.id, actor, at)
        db.add(PackingItem(session_id=sess.id, container_id=c.id,
                           contents_json=json.dumps(contents)))
    # The session has autoflush off, so later steps that walk sess.items would
    # see an empty list and leave these containers stuck in PACKING.
    db.flush()
    db.expire(sess, ["items"])


def step_complete_packing(db, order, sess, actor, at):
    for item in sess.items:
        c = db.get(Container, item.container_id)
        _cm(db, c, "PACKED", "PACKING_COMPLETED",
            "PACKING_SESSION", sess.id, actor, at)
    sess.status = "COMPLETED"
    sess.completed_at = at
    order.status = "PACKED"
    order.packed_at = at
    _oe(db, order, "complete_packing", "PACKING", "PACKED", actor, at)
    _al(db, "order", order.id, "ORDER_PACKED", actor, at)


def step_dispatch(db, order, sess, driver_id, vehicle, actor, at):
    dispatch = Dispatch(order_id=order.id, packing_session_id=sess.id,
                        driver_id=driver_id, vehicle_ref=vehicle,
                        status="DISPATCHED", confirmed_at=at, created_at=at)
    db.add(dispatch)
    db.flush()
    for item in sess.items:
        c = db.get(Container, item.container_id)
        db.add(DispatchItem(dispatch_id=dispatch.id, container_id=c.id))
        _cm(db, c, "IN_TRANSIT_TO_CUSTOMER", "DISPATCHED",
            "DISPATCH", dispatch.id, actor, at)
    # Ordered panels leave the station's stock when the vehicle is loaded.
    for line in db.query(OrderItem).filter_by(order_id=order.id).all():
        _stock(db, line.product_id, order.station_id, -line.quantity, "SALES",
               "ORDER", order.id, actor, at)
    task = DeliveryTask(dispatch_id=dispatch.id, driver_id=driver_id,
                        status="ASSIGNED", created_at=at)
    db.add(task)
    db.flush()
    order.status = "DISPATCHED"
    order.driver_id = driver_id
    order.dispatched_at = at
    _oe(db, order, "dispatch", "PACKED", "DISPATCHED", actor, at)
    _al(db, "order", order.id, "ORDER_DISPATCHED", actor, at)
    return dispatch, task


def step_depart(db, order, task, actor, at):
    task.status = "DEPARTED"
    task.departed_at = at
    order.status = "IN_TRANSIT"
    order.in_transit_at = at
    _oe(db, order, "depart", "DISPATCHED", "IN_TRANSIT", actor, at)


def step_arrive(db, order, task, actor, at):
    task.status = "ARRIVED"
    task.arrived_at = at
    order.status = "ARRIVED"
    order.arrived_at = at
    _oe(db, order, "arrive", "IN_TRANSIT", "ARRIVED", actor, at)
    # QR token
    import hashlib
    token = f"demo-token-{order.id}"
    db.add(QRToken(
        order_id=order.id,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        expires_at=at + timedelta(days=7),
    ))


def step_deliver(db, order, task, actor, at):
    task.status = "DELIVERED"
    task.delivered_at = at
    order.status = "DELIVERED"
    order.delivered_at = at
    _oe(db, order, "deliver", "ARRIVED", "DELIVERED", actor, at)


def step_confirm(db, order, sess, customer_id, customer_user,
                 actor, at, missing_ids=None, damaged_ids=None):
    missing_ids = set(missing_ids or [])
    damaged_ids = set(damaged_ids or [])
    for item in sess.items:
        c = db.get(Container, item.container_id)
        if c.id in missing_ids:
            db.add(ExceptionRecord(
                kind="MISSING_ON_DELIVERY", severity="CRITICAL", status="OPEN",
                reference_type="ORDER", reference_id=order.id,
                details_json=json.dumps({"container_id": c.id}),
                created_at=at,
            ))
            continue
        reason = ("CUSTOMER_REPORTED_DAMAGE" if c.id in damaged_ids
                  else "CUSTOMER_CONFIRMED_RECEIPT")
        _cm(db, c, "WITH_CUSTOMER", reason,
            "ORDER", order.id, customer_user, at, customer_id=customer_id)
        if c.id in damaged_ids:
            db.add(ExceptionRecord(
                kind="DAMAGED_ON_DELIVERY", severity="WARNING", status="OPEN",
                reference_type="ORDER", reference_id=order.id,
                details_json=json.dumps({"container_id": c.id}),
                created_at=at,
            ))

    order.customer_confirmed_at = at
    if missing_ids or damaged_ids:
        order.status = "DISPUTED"
        _oe(db, order, "dispute", "DELIVERED", "DISPUTED", customer_user, at,
            notes=f"{len(missing_ids)} missing, {len(damaged_ids)} damaged")
        _al(db, "order", order.id, "ORDER_DISPUTED", customer_user, at)
    else:
        order.status = "CUSTOMER_CONFIRMED"
        _oe(db, order, "confirm", "DELIVERED", "CUSTOMER_CONFIRMED",
            customer_user, at)
        _al(db, "order", order.id, "ORDER_CONFIRMED", customer_user, at)


def step_return_request(db, order, sess, customer_id, customer_user, actor, at):
    cids = [item.container_id for item in sess.items]
    ret = ReturnRequest(order_id=order.id, customer_id=customer_id,
                        container_ids_json=json.dumps(cids),
                        status="REQUESTED", created_at=at)
    db.add(ret)
    db.flush()
    for cid in cids:
        c = db.get(Container, cid)
        _cm(db, c, "RETURN_REQUESTED", "CUSTOMER_REQUESTED_RETURN",
            "RETURN_REQUEST", ret.id, customer_user, at)
    order.status = "RETURN_REQUESTED"
    order.return_requested_at = at
    _oe(db, order, "request_return", "CUSTOMER_CONFIRMED",
        "RETURN_REQUESTED", customer_user, at)
    return ret


def step_return_assign(db, order, ret, driver_id, actor, at):
    order.return_driver_id = driver_id
    _al(db, "order", order.id, "RETURN_DRIVER_ASSIGNED", actor, at,
        {"driver_id": driver_id})


def step_return_collect(db, order, ret, driver, actor, at):
    for cid_str in json.loads(ret.container_ids_json):
        c = db.get(Container, cid_str)
        _cm(db, c, "IN_TRANSIT_TO_STATION", "RETURN_COLLECTED",
            "RETURN_REQUEST", ret.id, actor, at, customer_id=None)
    ret.status = "COLLECTED"
    ret.collected_at = at
    order.status = "RETURN_COLLECTED"
    order.return_collected_at = at
    _oe(db, order, "collect_return", "RETURN_REQUESTED",
        "RETURN_COLLECTED", actor, at)


def step_return_receive(db, order, ret, actor, at):
    ret.status = "RECEIVED"
    ret.received_at = at
    order.status = "RETURN_RECEIVED"
    order.return_received_at = at
    _oe(db, order, "receive_return", "RETURN_COLLECTED",
        "RETURN_RECEIVED", actor, at)


def step_inspect(db, order, ret, conditions, station_id, actor, at):
    """conditions: dict[container_id] = 'OK' | 'DAMAGED' | 'CONTAMINATED'"""
    all_ok = True
    for cid_str in json.loads(ret.container_ids_json):
        c = db.get(Container, cid_str)
        cond = conditions.get(cid_str, "OK")
        if cond != "OK":
            all_ok = False
        db.add(ReturnInspection(
            return_id=ret.id, container_id=c.id,
            condition=cond, contains_panels=False,
            inspected_by=actor, inspected_at=at,
        ))
        _cm(db, c, "UNDER_INSPECTION", "STATION_RECEIVED",
            "RETURN_INSPECTION", ret.id, actor, at, location_id=station_id)
        final = ("AVAILABLE" if cond == "OK"
                 else "DAMAGED" if cond == "DAMAGED"
                 else "QUARANTINED")
        _cm(db, c, final, f"INSPECTION_{cond}",
            "RETURN_INSPECTION", ret.id, actor, at, location_id=station_id)
    if all_ok:
        order.status = "CLOSED"
        order.closed_at = at
        _oe(db, order, "close", "RETURN_RECEIVED", "CLOSED", actor, at)
        _al(db, "order", order.id, "ORDER_CLOSED", actor, at)


# ═══════════════════════════════════════════════════════════════════════
#  Reference data
# ═══════════════════════════════════════════════════════════════════════

def seed_reference(db: Session):
    db.add_all([
        Location(id="loc-fs-blr", code="FS-BLR", name="Freezing Station Bangalore",
                 kind="FREEZING_STATION",
                 address="Kannamangala, Bidarahalli, Bengaluru East 560049"),
        Location(id="loc-fs-chn", code="FS-CHN", name="Freezing Station Chennai",
                 kind="FREEZING_STATION",
                 address="Mowlivakkam, Porur, Chennai 600125"),
        Location(id="loc-fs-hyd", code="FS-HYD", name="Freezing Station Hyderabad",
                 kind="FREEZING_STATION",
                 address="Gachibowli, Hyderabad 500032"),
        Location(id="loc-fs-del", code="FS-DEL", name="Freezing Station Delhi NCR",
                 kind="FREEZING_STATION",
                 address="Udyog Vihar, Gurugram 122016"),
        Location(id="loc-wh-blr", code="WH-BLR", name="Warehouse Bangalore",
                 kind="WAREHOUSE",
                 address="Peenya Industrial Area, Bengaluru 560058"),
        Location(id="loc-wh-chn", code="WH-CHN", name="Warehouse Chennai",
                 kind="WAREHOUSE",
                 address="Ambattur Industrial Estate, Chennai 600058"),
    ])

    db.add_all([
        Customer(id="cust-hyperpure", name="Zomato Hyperpure",
                 contact_email="ops@hyperpure.example",
                 contact_phone="+91-80-4000-1111"),
        Customer(id="cust-instamart", name="Swiggy Instamart",
                 contact_email="ops@instamart.example",
                 contact_phone="+91-80-4000-2222"),
        Customer(id="cust-blinkit", name="Blinkit",
                 contact_email="ops@blinkit.example",
                 contact_phone="+91-124-4000-3333"),
        Customer(id="cust-kisaan", name="Kisaan Konnect",
                 contact_email="ops@kisaan.example",
                 contact_phone="+91-11-4000-4444"),
        Customer(id="cust-medplus", name="MedPlus Pharmacy",
                 contact_email="ops@medplus.example",
                 contact_phone="+91-40-4000-5555"),
        Customer(id="cust-zepto", name="Zepto",
                 contact_email="ops@zepto.example",
                 contact_phone="+91-22-4000-6666"),
    ])

    pw = hash_password("password123")
    db.add_all([
        User(id="usr-admin1", email="admin@tan90.local", full_name="Soumalya Mukherjee",
             password_hash=pw, role="SUPER_ADMIN"),
        User(id="usr-admin2", email="admin2@tan90.local", full_name="Narasimhan Santhanam",
             password_hash=pw, role="SUPER_ADMIN"),
        User(id="usr-ops1", email="ops@tan90.local", full_name="Ops Manager North",
             password_hash=pw, role="OPERATIONS_ADMIN"),
        User(id="usr-ops2", email="ops2@tan90.local", full_name="Ops Manager South",
             password_hash=pw, role="OPERATIONS_ADMIN"),
        User(id="usr-fsblr", email="fsblr@tan90.local", full_name="Ravi (FS-BLR)",
             password_hash=pw, role="FREEZING_STATION_MANAGER", location_id="loc-fs-blr"),
        User(id="usr-fschn", email="fschn@tan90.local", full_name="Priya (FS-CHN)",
             password_hash=pw, role="FREEZING_STATION_MANAGER", location_id="loc-fs-chn"),
        User(id="usr-whblr", email="whblr@tan90.local", full_name="Suresh (WH-BLR)",
             password_hash=pw, role="WAREHOUSE", location_id="loc-wh-blr"),
        User(id="usr-whchn", email="whchn@tan90.local", full_name="Mahesh (WH-CHN)",
             password_hash=pw, role="WAREHOUSE", location_id="loc-wh-chn"),
        User(id="usr-packer1", email="packer1@tan90.local", full_name="Packer A (FS-BLR)",
             password_hash=pw, role="PACKING_WORKER", location_id="loc-fs-blr"),
        User(id="usr-packer2", email="packer2@tan90.local", full_name="Packer B (FS-BLR)",
             password_hash=pw, role="PACKING_WORKER", location_id="loc-fs-blr"),
        User(id="usr-packer3", email="packer3@tan90.local", full_name="Packer C (FS-CHN)",
             password_hash=pw, role="PACKING_WORKER", location_id="loc-fs-chn"),
        User(id="usr-driver1", email="driver1@tan90.local", full_name="Vikram (BLR)",
             password_hash=pw, role="DRIVER"),
        User(id="usr-driver2", email="driver2@tan90.local", full_name="Arjun (BLR)",
             password_hash=pw, role="DRIVER"),
        User(id="usr-driver3", email="driver3@tan90.local", full_name="Karthik (CHN)",
             password_hash=pw, role="DRIVER"),
        User(id="usr-hyperpure", email="hyperpure@tan90.local", full_name="Hyperpure Ops",
             password_hash=pw, role="CUSTOMER", customer_id="cust-hyperpure"),
        User(id="usr-instamart", email="instamart@tan90.local", full_name="Instamart Ops",
             password_hash=pw, role="CUSTOMER", customer_id="cust-instamart"),
        User(id="usr-blinkit", email="blinkit@tan90.local", full_name="Blinkit Ops",
             password_hash=pw, role="CUSTOMER", customer_id="cust-blinkit"),
        User(id="usr-medplus", email="medplus@tan90.local", full_name="MedPlus Ops",
             password_hash=pw, role="CUSTOMER", customer_id="cust-medplus"),
        User(id="usr-sc", email="sc@tan90.local", full_name="Supply Chain Manager",
             password_hash=pw, role="SUPPLY_CHAIN_MANAGER"),
        User(id="usr-fshyd", email="fshyd@tan90.local", full_name="Anita (FS-HYD)",
             password_hash=pw, role="FREEZING_STATION_MANAGER", location_id="loc-fs-hyd"),
        User(id="usr-fsdel", email="fsdel@tan90.local", full_name="Rohit (FS-DEL)",
             password_hash=pw, role="FREEZING_STATION_MANAGER", location_id="loc-fs-del"),
        User(id="usr-packer4", email="packer4@tan90.local", full_name="Packer D (FS-HYD)",
             password_hash=pw, role="PACKING_WORKER", location_id="loc-fs-hyd"),
        User(id="usr-packer5", email="packer5@tan90.local", full_name="Packer E (FS-DEL)",
             password_hash=pw, role="PACKING_WORKER", location_id="loc-fs-del"),
        User(id="usr-driver4", email="driver4@tan90.local", full_name="Imran (HYD/DEL)",
             password_hash=pw, role="DRIVER"),
        User(id="usr-zepto", email="zepto@tan90.local", full_name="Zepto Ops",
             password_hash=pw, role="CUSTOMER", customer_id="cust-zepto"),
        User(id="usr-kisaan", email="kisaan@tan90.local", full_name="Kisaan Ops",
             password_hash=pw, role="CUSTOMER", customer_id="cust-kisaan"),
    ])

    db.add_all([
        Product(id="prd-pcm-neg50", sku="PCM-NEG50",
                name="PCM Panel -50 C (Ultra-cold Vaccine)", setpoint_c=-50.0),
        Product(id="prd-pcm-neg30", sku="PCM-NEG30",
                name="PCM Panel -30 C (Seafood)", setpoint_c=-30.0),
        Product(id="prd-pcm-neg24", sku="PCM-NEG24",
                name="PCM Panel -24 C (Frozen)", setpoint_c=-24.0),
        Product(id="prd-pcm-neg18", sku="PCM-NEG18",
                name="PCM Panel -18 C (Deep Chilled)", setpoint_c=-18.0),
        Product(id="prd-pcm-neg10", sku="PCM-NEG10",
                name="PCM Panel -10 C (Chilled)", setpoint_c=-10.0),
        Product(id="prd-pcm-sachet", sku="PCM-SACHET-100",
                name="PCM Sachet 100ml", setpoint_c=-10.0, unit="sachet"),
        Product(id="prd-pcm-pos2", sku="PCM-POS2",
                name="PCM Panel +2 C (Legacy)", setpoint_c=2.0, is_active=False),
        Product(id="prd-pcm-pos5", sku="PCM-POS5",
                name="PCM Panel +5 C (Pharma 2-8 C)", setpoint_c=5.0),
        Product(id="prd-bag-lastmile", sku="BAG-LASTMILE",
                name="Last Mile Delivery Bag", setpoint_c=5.0, unit="bag"),
        Product(id="prd-pcm-pos15", sku="PCM-POS15",
                name="PCM Panel +15 C (Warm Chain)", setpoint_c=15.0),
        Product(id="prd-gel-kit", sku="ACC-GELKIT",
                name="Gel Pack Accessory Kit", setpoint_c=None, unit="kit"),
    ])


def seed_containers(db: Session):
    plan = [
        ("loc-fs-blr", [("SHIP-20", 8), ("SHIP-40", 5), ("SHIP-60", 3), ("ICE-50", 4)]),
        ("loc-fs-chn", [("SHIP-15", 6), ("SHIP-20", 6), ("SHIP-100", 2), ("ICE-100", 2)]),
        ("loc-fs-hyd", [("SHIP-20", 4), ("BAG-20", 4)]),
        ("loc-fs-del", [("SHIP-40", 3), ("ICE-50", 3)]),
        ("loc-wh-blr", [("SHIP-60", 4), ("ICE-100", 2)]),
        ("loc-wh-chn", [("SHIP-20", 4)]),
    ]
    n = 0
    for loc_id, items in plan:
        for type_code, count in items:
            type_name, capacity = CONTAINER_TYPES[type_code]
            for _ in range(count):
                n += 1
                cid = f"con-{n:06d}"
                db.add(Container(
                    id=cid, container_code=f"CON-{n:06d}",
                    container_type=type_name, capacity_litres=capacity,
                    status="AVAILABLE", current_location_id=loc_id,
                ))
                db.add(RFIDTag(id=f"tag-{n:06d}", epc=epc_for(n),
                               container_id=cid, active=True))

    # con-000061 has no RFID tag yet (barcode only).
    type_name, capacity = CONTAINER_TYPES["SHIP-20"]
    db.add(Container(id="con-000061", container_code="CON-000061",
                     container_type=type_name, capacity_litres=capacity,
                     status="AVAILABLE", current_location_id="loc-fs-blr"))

    # con-000062 had its tag replaced: old tag inactive, new tag active.
    db.add(Container(id="con-000062", container_code="CON-000062",
                     container_type=type_name, capacity_litres=capacity,
                     status="AVAILABLE", current_location_id="loc-fs-blr"))
    db.add(RFIDTag(id="tag-000062-old", epc=epc_for(9062), container_id="con-000062",
                   active=False, created_at=ago(days=30), replaced_at=ago(days=6)))
    db.add(RFIDTag(id="tag-000062", epc=epc_for(62), container_id="con-000062",
                   active=True, created_at=ago(days=6)))


def seed_inventory(db: Session):
    """Opening stock, supplier receipts, transfers, write-offs and adjustments.

    Dispatch-time SALES movements are added later by step_dispatch.
    """
    OPS, FSB, FSC, FSH, FSD, WHB, WHC = (
        "usr-ops1", "usr-fsblr", "usr-fschn", "usr-fshyd", "usr-fsdel",
        "usr-whblr", "usr-whchn")
    BLR, CHN, HYD, DEL = "loc-fs-blr", "loc-fs-chn", "loc-fs-hyd", "loc-fs-del"
    WBLR, WCHN = "loc-wh-blr", "loc-wh-chn"

    # Opening stock per station (columns: neg50 neg24 neg18 neg10 sachet pos5 bag pos15).
    pids = ("prd-pcm-neg50", "prd-pcm-neg24", "prd-pcm-neg18", "prd-pcm-neg10",
            "prd-pcm-sachet", "prd-pcm-pos5", "prd-bag-lastmile", "prd-pcm-pos15")
    opening = {
        BLR: (40, 120, 80, 60, 200, 90, 30, 25),
        CHN: (25, 90, 60, 45, 150, 120, 20, 18),
        HYD: (15, 70, 50, 40, 100, 60, 25, 12),
        DEL: (20, 60, 45, 30, 80, 70, 18, 10),
    }
    for loc, quantities in opening.items():
        for pid, qty in zip(pids, quantities):
            _stock(db, pid, loc, qty, "NEW_INVENTORY", "MANUAL", "Opening stock",
                   OPS, ago(days=20))

    # Legacy product: stocked once, then fully written off (zero stock everywhere).
    _stock(db, "prd-pcm-pos2", BLR, 20, "NEW_INVENTORY", "MANUAL",
           "Opening stock", OPS, ago(days=20))
    _stock(db, "prd-pcm-pos2", BLR, -20, "DAMAGED", "MANUAL",
           "Discontinued, written off", FSB, ago(days=9))
    # prd-pcm-neg30 is intentionally never stocked: no balance rows at all.

    # Supplier receipts, including warehouses and a no-setpoint accessory.
    _stock(db, "prd-pcm-neg24", BLR, 60, "NEW_INVENTORY", "MANUAL",
           "Supplier: CoolChem, challan CH-2201", FSB, ago(days=12))
    _stock(db, "prd-pcm-pos5", CHN, 80, "NEW_INVENTORY", "MANUAL",
           "Supplier: PCM Labs, challan PL-8841", FSC, ago(days=12, minutes=90))
    _stock(db, "prd-pcm-sachet", WBLR, 500, "NEW_INVENTORY", "MANUAL",
           "Supplier: GelWorks, PO-5521", WHB, ago(days=11))
    _stock(db, "prd-pcm-neg18", WCHN, 200, "NEW_INVENTORY", "MANUAL",
           "Supplier: CoolChem, challan CH-2237", WHC, ago(days=11, minutes=45))
    _stock(db, "prd-pcm-neg50", HYD, 30, "NEW_INVENTORY", "MANUAL",
           "Supplier: CryoPack, challan CP-310", FSH, ago(days=10))
    _stock(db, "prd-gel-kit", WBLR, 300, "NEW_INVENTORY", "MANUAL",
           "Supplier: GelWorks, PO-5530", WHB, ago(days=10, minutes=30))
    _stock(db, "prd-gel-kit", BLR, 40, "NEW_INVENTORY", "MANUAL",
           "Supplier: GelWorks, PO-5530", FSB, ago(days=10))

    # Internal transfers between stations and warehouses.
    _transfer(db, "prd-pcm-neg10", BLR, WBLR, 25, OPS, ago(days=8))
    _transfer(db, "prd-pcm-neg18", WCHN, CHN, 40, WHC, ago(days=8, minutes=60))
    _transfer(db, "prd-pcm-neg24", HYD, DEL, 20, FSH, ago(days=7))
    _transfer(db, "prd-pcm-sachet", WBLR, BLR, 100, WHB, ago(days=7, minutes=120))
    _transfer(db, "prd-gel-kit", WBLR, CHN, 60, OPS, ago(days=5))
    _transfer(db, "prd-pcm-pos5", CHN, HYD, 30, FSC, ago(days=2))

    # Damage write-offs (outward).
    _stock(db, "prd-pcm-neg18", BLR, -3, "DAMAGED", "MANUAL",
           "Cracked in handling", FSB, ago(days=6))
    _stock(db, "prd-pcm-neg50", CHN, -2, "DAMAGED", "MANUAL",
           "Freezer failure, thawed", FSC, ago(days=4))

    # Stock adjustments (inward and outward); the last one zeroes a station balance.
    _stock(db, "prd-bag-lastmile", HYD, 5, "ADJUSTMENT_IN", "MANUAL",
           "Cycle count correction", FSH, ago(days=4, minutes=30))
    _stock(db, "prd-pcm-sachet", BLR, -12, "ADJUSTMENT_OUT", "MANUAL",
           "Cycle count correction", FSB, ago(days=3))
    _stock(db, "prd-pcm-pos15", DEL, -10, "ADJUSTMENT_OUT", "MANUAL",
           "Expired, written off", FSD, ago(days=3, minutes=90))


# ═══════════════════════════════════════════════════════════════════════
#  Orders — 15 orders across every state
# ═══════════════════════════════════════════════════════════════════════

def seed_orders(db: Session):
    OP1, PK1, PK3, FS_B, FS_C = ("usr-ops1", "usr-packer1", "usr-packer3",
                                  "usr-fsblr", "usr-fschn")
    DR1, DR2, DR3 = "usr-driver1", "usr-driver2", "usr-driver3"
    CH, CI, CB, CM = ("usr-hyperpure", "usr-instamart",
                      "usr-blinkit", "usr-medplus")

    # ─── ord-1: PENDING_OPS_APPROVAL ────────────────────────────────
    t = ago(minutes=30)
    o = Order(id="ord-1", order_number="ORD-0001",
              customer_id="cust-hyperpure", station_id="loc-fs-blr",
              destination="Hyperpure DC, Whitefield",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t,
              expected_delivery_at=t + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-1-1", order_id="ord-1",
                     product_id="prd-pcm-pos5", quantity=4))
    db.add(OrderItem(id="oi-ord-1-2", order_id="ord-1",
                     product_id="prd-pcm-neg10", quantity=2))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CH, t)
    _notif_role(db, "OPERATIONS_ADMIN", "ORDER_CREATED",
                "Order ORD-0001 needs approval",
                "Customer cust-hyperpure created an order",
                "order", o.id, t)

    # ─── ord-2: APPROVED ────────────────────────────────────────────
    t0 = ago(days=1, minutes=120)
    o = Order(id="ord-2", order_number="ORD-0002",
              customer_id="cust-instamart", station_id="loc-fs-blr",
              destination="Instamart Hub, Koramangala",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=2))
    db.add(o)
    db.add(OrderItem(id="oi-ord-2-1", order_id="ord-2",
                     product_id="prd-pcm-neg24", quantity=6))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CI, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=30))
    _notif_role(db, "FREEZING_STATION_MANAGER", "ORDER_APPROVED",
                "Order ORD-0002 approved", "Ready to pack",
                "order", o.id, t0 + timedelta(minutes=30),
                location_id="loc-fs-blr")

    # ─── ord-3: PACKING ────────────────────────────────────────────
    t0 = ago(days=1)
    o = Order(id="ord-3", order_number="ORD-0003",
              customer_id="cust-blinkit", station_id="loc-fs-blr",
              destination="Blinkit DC, Whitefield",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=2))
    db.add(o)
    db.add(OrderItem(id="oi-ord-3-1", order_id="ord-3",
                     product_id="prd-pcm-neg18", quantity=3))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CB, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000001"), [{"sku": "PCM-NEG18", "qty": 3}]),
    ], PK1, t0 + timedelta(minutes=90))

    # ─── ord-4: PACKED ─────────────────────────────────────────────
    t0 = ago(days=1, minutes=600)
    o = Order(id="ord-4", order_number="ORD-0004",
              customer_id="cust-medplus", station_id="loc-fs-chn",
              destination="MedPlus Warehouse, Chennai",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-4-1", order_id="ord-4",
                     product_id="prd-pcm-pos5", quantity=8))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CM, t0)
    step_approve(db, o, OP1, "loc-fs-chn", t0 + timedelta(minutes=30))
    sess = step_start_packing(db, o, PK3, t0 + timedelta(minutes=90))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000021"), [{"sku": "PCM-POS5", "qty": 5}]),
        (db.get(Container, "con-000022"), [{"sku": "PCM-POS5", "qty": 3}]),
    ], PK3, t0 + timedelta(minutes=120))
    step_complete_packing(db, o, sess, PK3, t0 + timedelta(minutes=150))

    # ─── ord-5: DISPATCHED ─────────────────────────────────────────
    t0 = ago(days=2)
    o = Order(id="ord-5", order_number="ORD-0005",
              customer_id="cust-hyperpure", station_id="loc-fs-blr",
              destination="Hyperpure DC, Whitefield",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-5-1", order_id="ord-5",
                     product_id="prd-pcm-pos5", quantity=6))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CH, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000002"), [{"sku": "PCM-POS5", "qty": 3}]),
        (db.get(Container, "con-000003"), [{"sku": "PCM-POS5", "qty": 3}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    step_dispatch(db, o, sess, DR1, "KA-01-AB-1234", PK1,
                  t0 + timedelta(minutes=180))
    _notif_user(db, DR1, "DRIVER_ASSIGNED",
                "You have a delivery: ORD-0005",
                "Pick up from FS-BLR", "order", o.id,
                t0 + timedelta(minutes=180))

    # ─── ord-6: IN_TRANSIT ─────────────────────────────────────────
    t0 = ago(days=2, minutes=120)
    o = Order(id="ord-6", order_number="ORD-0006",
              customer_id="cust-instamart", station_id="loc-fs-blr",
              destination="Instamart Hub, Koramangala",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-6-1", order_id="ord-6",
                     product_id="prd-pcm-neg24", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CI, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000004"), [{"sku": "PCM-NEG24", "qty": 2}]),
        (db.get(Container, "con-000005"), [{"sku": "PCM-NEG24", "qty": 2}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR1, "KA-01-AB-1234", PK1,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR1, t0 + timedelta(minutes=200))
    # GPS trail
    for mins in (30, 60, 90, 120):
        db.add(GPSEvent(
            task_id=task.id,
            recorded_at=t0 + timedelta(minutes=200 + mins),
            latitude=12.9716 + mins * 0.001,
            longitude=77.5946 + mins * 0.001,
            accuracy_m=8.5,
        ))

    # ─── ord-7: ARRIVED ────────────────────────────────────────────
    t0 = ago(days=3)
    o = Order(id="ord-7", order_number="ORD-0007",
              customer_id="cust-blinkit", station_id="loc-fs-blr",
              destination="Blinkit DC, Whitefield",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-7-1", order_id="ord-7",
                     product_id="prd-pcm-neg18", quantity=2))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CB, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000006"), [{"sku": "PCM-NEG18", "qty": 1}]),
        (db.get(Container, "con-000007"), [{"sku": "PCM-NEG18", "qty": 1}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR2, "KA-02-CD-5678", PK1,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR2, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR2, t0 + timedelta(minutes=400))
    _notif_user(db, CB, "DELIVERY_ARRIVED",
                "Your delivery ORD-0007 has arrived",
                "Open your portal to verify containers",
                "order", o.id, t0 + timedelta(minutes=400))

    # ─── ord-8: DELIVERED ──────────────────────────────────────────
    t0 = ago(days=3, minutes=180)
    o = Order(id="ord-8", order_number="ORD-0008",
              customer_id="cust-medplus", station_id="loc-fs-chn",
              destination="MedPlus Warehouse, Chennai",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-8-1", order_id="ord-8",
                     product_id="prd-pcm-pos5", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CM, t0)
    step_approve(db, o, OP1, "loc-fs-chn", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK3, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000023"), [{"sku": "PCM-POS5", "qty": 2}]),
        (db.get(Container, "con-000024"), [{"sku": "PCM-POS5", "qty": 2}]),
    ], PK3, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK3, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR3, "TN-01-EF-9999", PK3,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR3, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR3, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR3, t0 + timedelta(minutes=430))

    # ─── ord-9: CUSTOMER_CONFIRMED (custody transferred) ───────────
    t0 = ago(days=5)
    o = Order(id="ord-9", order_number="ORD-0009",
              customer_id="cust-hyperpure", station_id="loc-fs-blr",
              destination="Hyperpure DC, Whitefield",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-9-1", order_id="ord-9",
                     product_id="prd-pcm-pos5", quantity=6))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CH, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000008"), [{"sku": "PCM-POS5", "qty": 3}]),
        (db.get(Container, "con-000009"), [{"sku": "PCM-POS5", "qty": 3}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR1, "KA-01-AB-1234", PK1,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR1, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR1, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR1, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-hyperpure", CH, CH,
                 t0 + timedelta(minutes=500))

    # ─── ord-10: DISPUTED (1 missing) ──────────────────────────────
    t0 = ago(days=5, minutes=120)
    o = Order(id="ord-10", order_number="ORD-0010",
              customer_id="cust-instamart", station_id="loc-fs-blr",
              destination="Instamart Hub, Koramangala",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-10-1", order_id="ord-10",
                     product_id="prd-pcm-neg24", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CI, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000010"), [{"sku": "PCM-NEG24", "qty": 2}]),
        (db.get(Container, "con-000011"), [{"sku": "PCM-NEG24", "qty": 2}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR2, "KA-02-CD-5678", PK1,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR2, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR2, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR2, t0 + timedelta(minutes=430))
    # con-000011 is reported missing
    step_confirm(db, o, sess, "cust-instamart", CI, CI,
                 t0 + timedelta(minutes=500), missing_ids=["con-000011"])
    # Also mark the missing container
    c_missing = db.get(Container, "con-000011")
    c_missing.status = "MISSING"

    # ─── ord-11: RETURN_REQUESTED ──────────────────────────────────
    t0 = ago(days=7)
    o = Order(id="ord-11", order_number="ORD-0011",
              customer_id="cust-blinkit", station_id="loc-fs-blr",
              destination="Blinkit DC, Whitefield",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-11-1", order_id="ord-11",
                     product_id="prd-pcm-neg18", quantity=2))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CB, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000012"), [{"sku": "PCM-NEG18", "qty": 1}]),
        (db.get(Container, "con-000013"), [{"sku": "PCM-NEG18", "qty": 1}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR1, "KA-01-AB-1234", PK1,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR1, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR1, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR1, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-blinkit", CB, CB,
                 t0 + timedelta(minutes=500))
    step_return_request(db, o, sess, "cust-blinkit", CB, CB,
                        t0 + timedelta(minutes=1500))
    _notif_role(db, "OPERATIONS_ADMIN", "RETURN_REQUESTED",
                "Return requested: ORD-0011",
                "2 containers", "order", o.id,
                t0 + timedelta(minutes=1500))

    # ─── ord-12: RETURN_COLLECTED ──────────────────────────────────
    t0 = ago(days=8)
    o = Order(id="ord-12", order_number="ORD-0012",
              customer_id="cust-medplus", station_id="loc-fs-chn",
              destination="MedPlus Warehouse, Chennai",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-12-1", order_id="ord-12",
                     product_id="prd-pcm-pos5", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CM, t0)
    step_approve(db, o, OP1, "loc-fs-chn", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK3, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000025"), [{"sku": "PCM-POS5", "qty": 2}]),
        (db.get(Container, "con-000026"), [{"sku": "PCM-POS5", "qty": 2}]),
    ], PK3, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK3, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR3, "TN-01-EF-9999", PK3,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR3, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR3, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR3, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-medplus", CM, CM,
                 t0 + timedelta(minutes=500))
    ret = step_return_request(db, o, sess, "cust-medplus", CM, CM,
                              t0 + timedelta(minutes=1500))
    step_return_assign(db, o, ret, DR3, OP1, t0 + timedelta(minutes=1560))
    step_return_collect(db, o, ret, DR3, DR3, t0 + timedelta(minutes=1620))

    # ─── ord-13: RETURN_RECEIVED ───────────────────────────────────
    t0 = ago(days=9)
    o = Order(id="ord-13", order_number="ORD-0013",
              customer_id="cust-hyperpure", station_id="loc-fs-blr",
              destination="Hyperpure DC, Whitefield",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-13-1", order_id="ord-13",
                     product_id="prd-pcm-pos5", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CH, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000014"), [{"sku": "PCM-POS5", "qty": 2}]),
        (db.get(Container, "con-000015"), [{"sku": "PCM-POS5", "qty": 2}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR1, "KA-01-AB-1234", PK1,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR1, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR1, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR1, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-hyperpure", CH, CH,
                 t0 + timedelta(minutes=500))
    ret = step_return_request(db, o, sess, "cust-hyperpure", CH, CH,
                              t0 + timedelta(minutes=1500))
    step_return_assign(db, o, ret, DR1, OP1, t0 + timedelta(minutes=1560))
    step_return_collect(db, o, ret, DR1, DR1, t0 + timedelta(minutes=1620))
    step_return_receive(db, o, ret, FS_B, t0 + timedelta(minutes=1700))
    _notif_role(db, "FREEZING_STATION_MANAGER", "RETURN_INBOUND",
                "Return inbound: ORD-0013",
                "Driver delivered containers", "order", o.id,
                t0 + timedelta(minutes=1700),
                location_id="loc-fs-blr")

    # ─── ord-14: CLOSED (all clean) ────────────────────────────────
    t0 = ago(days=10)
    o = Order(id="ord-14", order_number="ORD-0014",
              customer_id="cust-instamart", station_id="loc-fs-blr",
              destination="Instamart Hub, Koramangala",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-14-1", order_id="ord-14",
                     product_id="prd-pcm-neg24", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CI, t0)
    step_approve(db, o, OP1, "loc-fs-blr", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK1, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000016"), [{"sku": "PCM-NEG24", "qty": 2}]),
        (db.get(Container, "con-000017"), [{"sku": "PCM-NEG24", "qty": 2}]),
    ], PK1, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK1, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR1, "KA-01-AB-1234", PK1,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR1, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR1, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR1, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-instamart", CI, CI,
                 t0 + timedelta(minutes=500))
    ret = step_return_request(db, o, sess, "cust-instamart", CI, CI,
                              t0 + timedelta(minutes=1500))
    step_return_assign(db, o, ret, DR1, OP1, t0 + timedelta(minutes=1560))
    step_return_collect(db, o, ret, DR1, DR1, t0 + timedelta(minutes=1620))
    step_return_receive(db, o, ret, FS_B, t0 + timedelta(minutes=1700))
    step_inspect(db, o, ret, {}, "loc-fs-blr", FS_B,
                 t0 + timedelta(minutes=1750))

    # ─── ord-15: RETURN_RECEIVED with a damaged container ──────────
    t0 = ago(days=6)
    o = Order(id="ord-15", order_number="ORD-0015",
              customer_id="cust-medplus", station_id="loc-fs-chn",
              destination="MedPlus Warehouse, Chennai",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-15-1", order_id="ord-15",
                     product_id="prd-pcm-pos5", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CM, t0)
    step_approve(db, o, OP1, "loc-fs-chn", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK3, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000027"), [{"sku": "PCM-POS5", "qty": 2}]),
        (db.get(Container, "con-000028"), [{"sku": "PCM-POS5", "qty": 2}]),
    ], PK3, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK3, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR3, "TN-01-EF-9999", PK3,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR3, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR3, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR3, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-medplus", CM, CM,
                 t0 + timedelta(minutes=500))
    ret = step_return_request(db, o, sess, "cust-medplus", CM, CM,
                              t0 + timedelta(minutes=1500))
    step_return_assign(db, o, ret, DR3, OP1, t0 + timedelta(minutes=1560))
    step_return_collect(db, o, ret, DR3, DR3, t0 + timedelta(minutes=1620))
    step_return_receive(db, o, ret, FS_C, t0 + timedelta(minutes=1700))
    # con-000028 damaged → order stays RETURN_RECEIVED
    step_inspect(db, o, ret,
                 {"con-000028": "DAMAGED"}, "loc-fs-chn", FS_C,
                 t0 + timedelta(minutes=1750))

    # Hyderabad and Delhi stations, with their own drivers and customers.
    FS_H, FS_D, PK4, PK5, DR4 = ("usr-fshyd", "usr-fsdel", "usr-packer4",
                                  "usr-packer5", "usr-driver4")
    CZ, CK = "usr-zepto", "usr-kisaan"

    # ─── ord-16: DISPUTED (one container reported damaged) ─────────
    t0 = ago(days=4)
    o = Order(id="ord-16", order_number="ORD-0016",
              customer_id="cust-zepto", station_id="loc-fs-hyd",
              destination="Zepto Dark Store, Madhapur",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-16-1", order_id="ord-16",
                     product_id="prd-pcm-pos5", quantity=4))
    db.add(OrderItem(id="oi-ord-16-2", order_id="ord-16",
                     product_id="prd-bag-lastmile", quantity=2))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CZ, t0)
    step_approve(db, o, OP1, "loc-fs-hyd", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK4, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000037"), [{"sku": "PCM-POS5", "qty": 4}]),
        (db.get(Container, "con-000041"), [{"sku": "BAG-LASTMILE", "qty": 2}]),
    ], PK4, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK4, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR4, "TS-09-GH-4321", PK4,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR4, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR4, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR4, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-zepto", CZ, CZ,
                 t0 + timedelta(minutes=500), damaged_ids=["con-000041"])

    # ─── ord-17: RETURN_RECEIVED, one container contaminated ───────
    t0 = ago(days=11)
    o = Order(id="ord-17", order_number="ORD-0017",
              customer_id="cust-kisaan", station_id="loc-fs-del",
              destination="Kisaan Cold Store, Azadpur",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-17-1", order_id="ord-17",
                     product_id="prd-pcm-neg18", quantity=4))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CK, t0)
    step_approve(db, o, OP1, "loc-fs-del", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK5, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000045"), [{"sku": "PCM-NEG18", "qty": 2}]),
        (db.get(Container, "con-000046"), [{"sku": "PCM-NEG18", "qty": 2}]),
    ], PK5, t0 + timedelta(minutes=90))
    step_complete_packing(db, o, sess, PK5, t0 + timedelta(minutes=120))
    _, task = step_dispatch(db, o, sess, DR4, "DL-01-JK-7788", PK5,
                            t0 + timedelta(minutes=180))
    step_depart(db, o, task, DR4, t0 + timedelta(minutes=200))
    step_arrive(db, o, task, DR4, t0 + timedelta(minutes=400))
    step_deliver(db, o, task, DR4, t0 + timedelta(minutes=430))
    step_confirm(db, o, sess, "cust-kisaan", CK, CK,
                 t0 + timedelta(minutes=500))
    ret = step_return_request(db, o, sess, "cust-kisaan", CK, CK,
                              t0 + timedelta(minutes=1500))
    step_return_assign(db, o, ret, DR4, OP1, t0 + timedelta(minutes=1560))
    step_return_collect(db, o, ret, DR4, DR4, t0 + timedelta(minutes=1620))
    step_return_receive(db, o, ret, FS_D, t0 + timedelta(minutes=1700))
    step_inspect(db, o, ret, {"con-000046": "CONTAMINATED"}, "loc-fs-del", FS_D,
                 t0 + timedelta(minutes=1750))

    # ─── ord-18: PACKING with three product lines, two containers ──
    t0 = ago(minutes=240)
    o = Order(id="ord-18", order_number="ORD-0018",
              customer_id="cust-zepto", station_id="loc-fs-hyd",
              destination="Zepto Dark Store, Gachibowli",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-18-1", order_id="ord-18",
                     product_id="prd-pcm-neg24", quantity=6))
    db.add(OrderItem(id="oi-ord-18-2", order_id="ord-18",
                     product_id="prd-pcm-sachet", quantity=20))
    db.add(OrderItem(id="oi-ord-18-3", order_id="ord-18",
                     product_id="prd-gel-kit", quantity=2))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CZ, t0)
    step_approve(db, o, OP1, "loc-fs-hyd", t0 + timedelta(minutes=20))
    sess = step_start_packing(db, o, PK4, t0 + timedelta(minutes=60))
    step_scan(db, o, sess, [
        (db.get(Container, "con-000038"),
         [{"sku": "PCM-NEG24", "qty": 6}, {"sku": "PCM-SACHET-100", "qty": 20}]),
    ], PK4, t0 + timedelta(minutes=90))

    # ─── ord-19: CANCELLED while pending ───────────────────────────
    t0 = ago(days=3, minutes=200)
    o = Order(id="ord-19", order_number="ORD-0019",
              customer_id="cust-kisaan", station_id="loc-fs-del",
              destination="Kisaan Cold Store, Azadpur",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=2))
    db.add(o)
    db.add(OrderItem(id="oi-ord-19-1", order_id="ord-19",
                     product_id="prd-pcm-neg30", quantity=10))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CK, t0)
    o.status = "CANCELLED"
    _oe(db, o, "cancel", "PENDING_OPS_APPROVAL", "CANCELLED", OP1,
        t0 + timedelta(minutes=45), notes="SKU not available")
    _al(db, "order", o.id, "ORDER_CANCELLED", OP1, t0 + timedelta(minutes=45))

    # ─── ord-20: CANCELLED after approval ──────────────────────────
    t0 = ago(days=6, minutes=300)
    o = Order(id="ord-20", order_number="ORD-0020",
              customer_id="cust-medplus", station_id="loc-fs-chn",
              destination="MedPlus Warehouse, Chennai",
              status="PENDING_OPS_APPROVAL", created_by=OP1, created_at=t0,
              expected_delivery_at=t0 + timedelta(days=1))
    db.add(o)
    db.add(OrderItem(id="oi-ord-20-1", order_id="ord-20",
                     product_id="prd-pcm-neg50", quantity=5))
    _oe(db, o, "create", "—", "PENDING_OPS_APPROVAL", CM, t0)
    step_approve(db, o, OP1, "loc-fs-chn", t0 + timedelta(minutes=30))
    o.status = "CANCELLED"
    _oe(db, o, "cancel", "APPROVED", "CANCELLED", OP1,
        t0 + timedelta(minutes=240), notes="Customer postponed the shipment")
    _al(db, "order", o.id, "ORDER_CANCELLED", OP1, t0 + timedelta(minutes=240))


# ═══════════════════════════════════════════════════════════════════════
#  Container statuses not covered by order flow
# ═══════════════════════════════════════════════════════════════════════

def seed_extra_container_states(db: Session):
    """Container states the order flow leaves empty: QUARANTINED, DAMAGED, UNDER_INSPECTION."""
    c = db.get(Container, "con-000036")
    if c and c.status == "AVAILABLE":
        _cm(db, c, "QUARANTINED", "MANUAL_QUARANTINE",
            "INSPECTION", "seed", "usr-fsblr", ago(days=4),
            location_id="loc-fs-chn")

    # Damaged during handling, then sent back for inspection.
    c = db.get(Container, "con-000018")
    _cm(db, c, "DAMAGED", "MANUAL_DAMAGE", "INSPECTION", "seed",
        "usr-fsblr", ago(days=2, minutes=240))
    _cm(db, c, "UNDER_INSPECTION", "REINSPECTION", "INSPECTION", "seed",
        "usr-fsblr", ago(days=1))

    # Damaged and waiting for repair.
    c = db.get(Container, "con-000019")
    _cm(db, c, "DAMAGED", "MANUAL_DAMAGE", "INSPECTION", "seed",
        "usr-fsblr", ago(days=3))

    # Missing from the station floor.
    c = db.get(Container, "con-000049")
    _cm(db, c, "MISSING", "CYCLE_COUNT_MISSING", "INSPECTION", "seed",
        "usr-fsdel", ago(days=2))
    db.add(ExceptionRecord(
        id="exc-demo-5", kind="MISSING_ON_DELIVERY", severity="CRITICAL",
        status="OPEN", reference_type="CONTAINER", reference_id="con-000049",
        details_json=json.dumps({"container_id": "con-000049"}),
        created_at=ago(days=2),
    ))


# ═══════════════════════════════════════════════════════════════════════
#  Exceptions
# ═══════════════════════════════════════════════════════════════════════

def seed_exceptions(db: Session):
    db.add(ExceptionRecord(
        id="exc-demo-1", kind="UNKNOWN_EPC", severity="WARNING", status="OPEN",
        reference_type="SCAN_SESSION", reference_id="scan-demo",
        details_json=json.dumps({"epc": "E280A1UNKNOWN000000000000"}),
        created_at=ago(minutes=45),
    ))
    db.add(ExceptionRecord(
        id="exc-demo-2", kind="UNKNOWN_EPC", severity="WARNING", status="RESOLVED",
        reference_type="SCAN_SESSION", reference_id="scan-demo-2",
        details_json=json.dumps({"epc": "E280A1UNKNOWN000000000099"}),
        created_at=ago(days=5), resolved_at=ago(days=4), resolved_by="usr-ops1",
    ))
    db.add(ExceptionRecord(
        id="exc-demo-3", kind="DAMAGED_ON_DELIVERY", severity="WARNING",
        status="RESOLVED", reference_type="ORDER", reference_id="ord-14",
        details_json=json.dumps({"container_id": "con-000016"}),
        created_at=ago(days=9), resolved_at=ago(days=8), resolved_by="usr-ops2",
    ))
    db.add(ExceptionRecord(
        id="exc-demo-4", kind="MISSING_ON_DELIVERY", severity="CRITICAL",
        status="RESOLVED", reference_type="ORDER", reference_id="ord-14",
        details_json=json.dumps({"container_id": "con-000017"}),
        created_at=ago(days=9), resolved_at=ago(days=7), resolved_by="usr-ops1",
    ))
    db.add(ExceptionRecord(
        id="exc-demo-6", kind="UNKNOWN_EPC", severity="WARNING", status="OPEN",
        reference_type="SCAN_SESSION", reference_id="scan-demo-3",
        details_json=json.dumps({"epc": "E280A1UNKNOWN000000000123"}),
        created_at=ago(days=1, minutes=30),
    ))


# ═══════════════════════════════════════════════════════════════════════
#  Notifications for empty inboxes
# ═══════════════════════════════════════════════════════════════════════

def seed_notifications(db: Session):
    t = ago(minutes=60)
    # Packer work queue
    _notif_role(db, "PACKING_WORKER", "ORDER_APPROVED",
                "Order ORD-0002 approved",
                "Ready to pack at FS-BLR", "order", "ord-2", t,
                location_id="loc-fs-blr")
    _notif_role(db, "PACKING_WORKER", "ORDER_APPROVED",
                "Order ORD-0004 approved",
                "Ready to pack at FS-CHN", "order", "ord-4",
                ago(days=1, minutes=600), location_id="loc-fs-chn")
    # FSM inbound return
    _notif_role(db, "FREEZING_STATION_MANAGER", "RETURN_INBOUND",
                "Return inbound: ORD-0013",
                "Driver brings containers to your station", "order", "ord-13",
                ago(days=9, minutes=1700), location_id="loc-fs-blr")
    # Driver task
    _notif_user(db, "usr-driver1", "DRIVER_ASSIGNED",
                "You have a delivery: ORD-0005",
                "Pick up from FS-BLR", "order", "ord-5",
                ago(days=2, minutes=180))
    # Customer delivery
    _notif_user(db, "usr-blinkit", "DELIVERY_ARRIVED",
                "Your delivery ORD-0007 has arrived",
                "Verify containers in your portal", "order", "ord-7",
                ago(days=3, minutes=400))
    # Ops alerts for disputes and a return, one already read.
    _notif_role(db, "OPERATIONS_ADMIN", "DELIVERY_DISPUTED",
                "Order ORD-0016 disputed", "Missing: 0, Damaged: 1",
                "order", "ord-16", ago(days=4, minutes=-500))
    _notif_role(db, "OPERATIONS_ADMIN", "DELIVERY_DISPUTED",
                "Order ORD-0010 disputed", "Missing: 1, Damaged: 0",
                "order", "ord-10", ago(days=5, minutes=-500))
    db.flush()
    read = db.query(Notification).filter_by(reference_id="ord-10",
                                            kind="DELIVERY_DISPUTED").first()
    read.read_at = ago(days=4)
    _notif_user(db, "usr-zepto", "DELIVERY_ARRIVED",
                "Your delivery ORD-0016 has arrived",
                "Verify containers in your portal", "order", "ord-16",
                ago(days=4, minutes=-400))
    _notif_user(db, "usr-driver4", "DRIVER_ASSIGNED",
                "You have a delivery: ORD-0017", "Pick up from FS-DEL",
                "order", "ord-17", ago(days=11, minutes=-180))


# ═══════════════════════════════════════════════════════════════════════
#  Entry point
# ═══════════════════════════════════════════════════════════════════════

def seed() -> None:
    init_schema()
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return  # already seeded, silent on startup
        print("Seeding database...")
        seed_reference(db)
        db.flush()
        seed_containers(db)
        db.flush()
        seed_inventory(db)
        db.flush()
        seed_orders(db)
        db.flush()
        seed_extra_container_states(db)
        seed_exceptions(db)
        seed_notifications(db)
        db.commit()
        print("Seed complete: 27 users, 62 containers, 20 orders "
              "(every order and container state populated).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("\nTo run standalone, use: python -m app.db.seed")
    print("Auto-seed runs on uvicorn startup.")