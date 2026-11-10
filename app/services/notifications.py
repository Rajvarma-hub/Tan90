from sqlalchemy.orm import Session
from app.models.notification import Notification


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
