from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.order_states import OrderStatus
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.container import Container
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_event import OrderEvent
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview")
def overview(
    user: User = Depends(require_roles(
        "SUPER_ADMIN", "OPERATIONS_ADMIN", "SUPPLY_CHAIN_MANAGER")),
    db: Session = Depends(get_db),
):
    statuses = [
        "AVAILABLE", "PACKING", "PACKED", "IN_TRANSIT_TO_CUSTOMER",
        "WITH_CUSTOMER", "RETURN_REQUESTED", "IN_TRANSIT_TO_STATION",
        "UNDER_INSPECTION", "DAMAGED", "QUARANTINED", "MISSING",
    ]
    containers = {
        s: db.query(func.count(Container.id)).filter(Container.status == s).scalar()
        for s in statuses
    }
    orders = {
        s: db.query(func.count(Order.id)).filter(Order.status == s).scalar()
        for s in OrderStatus.ALL
    }
    custody = db.query(
        Customer.id, Customer.name, func.count(Container.id)
    ).join(
        Container, Container.current_customer_id == Customer.id
    ).filter(
        Container.status == "WITH_CUSTOMER"
    ).group_by(Customer.id).all()

    return {
        "containers_by_status": containers,
        "orders_by_status": orders,
        "containers_held_by_customers": [
            {"customer_id": cid, "customer_name": name, "count": count}
            for cid, name, count in custody
        ],
        "total_containers": sum(containers.values()),
        "total_orders": sum(orders.values()),
    }


@router.get("/pending-approvals")
def pending_approvals(
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
    db: Session = Depends(get_db),
):
    rows = db.query(Order).filter(
        Order.status == "PENDING_OPS_APPROVAL"
    ).order_by(Order.created_at).all()
    return [
        {"id": r.id, "order_number": r.order_number,
         "customer_id": r.customer_id, "created_at": r.created_at}
        for r in rows
    ]


@router.get("/activity")
def activity(
    limit: int = Query(50, ge=1, le=500),
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
    db: Session = Depends(get_db),
):
    """Recent changes, newest first: order steps plus edits to containers, products and stations."""
    # Order steps are recorded as order events, so the audit rows about orders would repeat them.
    audit = db.query(AuditLog).filter(AuditLog.entity_type != "order").order_by(
        AuditLog.occurred_at.desc()).limit(limit).all()
    steps = db.query(OrderEvent, Order.order_number).join(
        Order, Order.id == OrderEvent.order_id
    ).order_by(OrderEvent.occurred_at.desc()).limit(limit).all()

    feed = [
        {"id": r.id, "entity_type": r.entity_type, "entity_id": r.entity_id,
         "entity_label": None, "action": r.action, "actor_id": r.actor_id,
         "occurred_at": r.occurred_at}
        for r in audit
    ] + [
        {"id": e.id, "entity_type": "order", "entity_id": e.order_id,
         "entity_label": number, "action": e.action, "actor_id": e.actor_id,
         "occurred_at": e.occurred_at}
        for e, number in steps
    ]
    feed.sort(key=lambda row: row["occurred_at"], reverse=True)
    return feed[:limit]
