"""Container read model: a container plus where it is and which order it is on."""
from sqlalchemy.orm import Session

from app.models.container import Container
from app.models.customer import Customer
from app.models.location import Location
from app.models.order import Order
from app.models.packing import PackingItem, PackingSession
from app.models.rfid import RFIDTag

# Statuses in which a container is committed to an order. Outside these it is
# free stock (or written off) and has no current order.
ON_ORDER_STATUSES = {
    "PACKING", "PACKED", "IN_TRANSIT_TO_CUSTOMER", "WITH_CUSTOMER",
    "RETURN_REQUESTED", "IN_TRANSIT_TO_STATION", "UNDER_INSPECTION",
}


def orders_by_container(db: Session, container_ids: list[str]) -> dict[str, list[Order]]:
    """Every order each container has been packed for, newest first.
    A container joins an order when it is scanned into that order's packing session."""
    if not container_ids:
        return {}
    rows = db.query(PackingItem.container_id, Order).join(
        PackingSession, PackingSession.id == PackingItem.session_id
    ).join(Order, Order.id == PackingSession.order_id).filter(
        PackingItem.container_id.in_(container_ids)
    ).order_by(PackingSession.created_at.desc()).all()
    out: dict[str, list[Order]] = {}
    for container_id, order in rows:
        out.setdefault(container_id, []).append(order)
    return out


def describe(db: Session, containers: list[Container]) -> list[dict]:
    ids = [c.id for c in containers]
    epcs = {
        t.container_id: t.epc for t in db.query(RFIDTag).filter(
            RFIDTag.container_id.in_(ids), RFIDTag.active == True).all()  # noqa: E712
    } if ids else {}
    locations = {loc.id: loc for loc in db.query(Location).all()}
    customers = {cust.id: cust.name for cust in db.query(Customer).all()}
    orders = orders_by_container(db, ids)

    out = []
    for c in containers:
        current = None
        if c.status in ON_ORDER_STATUSES and orders.get(c.id):
            o = orders[c.id][0]
            current = {
                "id": o.id, "order_number": o.order_number, "status": o.status,
                "customer_id": o.customer_id,
                "customer_name": customers.get(o.customer_id),
            }
        loc = locations.get(c.current_location_id) if c.current_location_id else None
        out.append({
            "id": c.id,
            "container_code": c.container_code,
            "container_type": c.container_type,
            "capacity_litres": float(c.capacity_litres),
            "status": c.status,
            "current_location_id": c.current_location_id,
            "current_customer_id": c.current_customer_id,
            "epc": epcs.get(c.id),
            "location_code": loc.code if loc else None,
            "location_name": loc.name if loc else None,
            "customer_name": customers.get(c.current_customer_id)
            if c.current_customer_id else None,
            "current_order": current,
        })
    return out
