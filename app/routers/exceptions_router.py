from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.audit import ExceptionRecord
from app.models.user import User

router = APIRouter(prefix="/api/exceptions", tags=["exceptions"])


@router.get("")
def list_exceptions(
    status: str | None = "OPEN",
    kind: str | None = None,
    user: User = Depends(require_roles(
        "SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER",
        "SUPPLY_CHAIN_MANAGER")),
    db: Session = Depends(get_db),
):
    q = db.query(ExceptionRecord)
    if status:
        q = q.filter(ExceptionRecord.status == status)
    if kind:
        q = q.filter(ExceptionRecord.kind == kind)
    rows = q.order_by(ExceptionRecord.created_at.desc()).limit(200).all()
    return [
        {
            "id": r.id, "kind": r.kind, "severity": r.severity,
            "status": r.status, "reference_type": r.reference_type,
            "reference_id": r.reference_id, "details": r.details_json,
            "created_at": r.created_at, "resolved_at": r.resolved_at,
        }
        for r in rows
    ]


@router.post("/{exception_id}/resolve")
def resolve_exception(
    exception_id: str,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
    db: Session = Depends(get_db),
):
    r = db.get(ExceptionRecord, exception_id)
    if not r:
        raise HTTPException(404, "Exception not found")
    r.status = "RESOLVED"
    r.resolved_at = datetime.now(timezone.utc)
    r.resolved_by = user.id
    db.commit()
    return {"id": r.id, "status": r.status}
