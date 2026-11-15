from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User


def notify_user(db: Session, user_id: str, *, kind: str, title: str, body: str,
                reference_type: str | None = None, reference_id: str | None = None) -> Notification:
    n = Notification(
        recipient_user_id=user_id, kind=kind, title=title, body=body,
        reference_type=reference_type, reference_id=reference_id,
    )
    db.add(n)
    return n


def notify_role(db: Session, role: str, *, kind: str, title: str, body: str,
                location_id: str | None = None,
                reference_type: str | None = None, reference_id: str | None = None) -> Notification:
    n = Notification(
        recipient_role=role, recipient_location_id=location_id,
        kind=kind, title=title, body=body,
        reference_type=reference_type, reference_id=reference_id,
    )
    db.add(n)
    return n


def notify_customer(db: Session, customer_id: str, *, kind: str, title: str, body: str,
                    reference_type: str | None = None, reference_id: str | None = None) -> None:
    """Everyone who signs in for that customer hears about it, not just the first account."""
    users = db.query(User).filter(
        User.customer_id == customer_id, User.role == "CUSTOMER", User.is_active == True,  # noqa: E712
    ).all()
    for u in users:
        notify_user(db, u.id, kind=kind, title=title, body=body,
                    reference_type=reference_type, reference_id=reference_id)
