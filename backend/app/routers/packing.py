import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.order_states import check_container_transition, InvalidContainerTransition
from app.db.session import get_db
from app.models.audit import ContainerMovement, ExceptionRecord
from app.models.container import Container
from app.models.order import Order
from app.models.packing import PackingItem, PackingSession
from app.models.rfid import RFIDScanEvent, RFIDScanSession, RFIDTag
from app.models.user import User
from app.schemas.packing import PackingItemContentsIn, PackingScanIn, PackingScanResult
from app.services import order_flow
from app.services.scan import resolve_scan

router = APIRouter(prefix="/api", tags=["packing"])

PACK_ROLES = ("PACKING_WORKER", "FREEZING_STATION_MANAGER", "OPERATIONS_ADMIN", "SUPER_ADMIN")


@router.post("/orders/{order_id}/packing-sessions")
def start_packing(order_id: str,
                  user: User = Depends(require_roles(*PACK_ROLES)),
                  db: Session = Depends(get_db)):
    session = order_flow.start_packing(db, order_id, user)
    return {"id": session.id, "order_id": session.order_id, "status": session.status}


@router.post("/packing-sessions/{session_id}/scans", response_model=PackingScanResult)
def scan_packing(session_id: str, payload: PackingScanIn,
                 user: User = Depends(require_roles(*PACK_ROLES)),
                 db: Session = Depends(get_db)):
    session = db.get(PackingSession, session_id)
    if not session or session.status != "OPEN":
        raise HTTPException(409, "Session not open")

    scan_session = RFIDScanSession(
        purpose="PACKING", reference_id=session.id, actor_id=user.id, status="OPEN",
    )
    db.add(scan_session)
    db.flush()

    added, duplicates, unknown, unavailable = [], [], [], []
    for epc in payload.epcs:
        # A scan is a tag ID or the container code on the barcode label.
        c = resolve_scan(db, epc)
        if not c:
            unknown.append(epc)
            db.add(RFIDScanEvent(session_id=scan_session.id, epc=epc))
            db.add(ExceptionRecord(
                kind="UNKNOWN_EPC", severity="WARNING", status="OPEN",
                reference_type="PACKING_SESSION", reference_id=session.id,
                details_json=json.dumps({"epc": epc}),
            ))
            continue
        already = db.query(PackingItem).filter(
            PackingItem.session_id == session.id, PackingItem.container_id == c.id,
        ).first()
        if already:
            duplicates.append(epc)
            db.add(RFIDScanEvent(session_id=scan_session.id, epc=epc, container_id=c.id))
            continue
        if c.status != "AVAILABLE" or c.current_location_id != session.station_id:
            unavailable.append({"epc": epc, "container_id": c.id, "status": c.status})
            db.add(RFIDScanEvent(session_id=scan_session.id, epc=epc, container_id=c.id))
            continue

        try:
            check_container_transition(c.status, "PACKING")
        except InvalidContainerTransition as e:
            raise HTTPException(409, str(e))
        db.add(ContainerMovement(
            container_id=c.id, from_status=c.status, to_status="PACKING",
            reason="PACKING_STARTED", reference_type="PACKING_SESSION",
            reference_id=session.id, actor_id=user.id,
        ))
        c.status = "PACKING"
        db.add(RFIDScanEvent(session_id=scan_session.id, epc=epc, container_id=c.id))
        db.add(PackingItem(session_id=session.id, container_id=c.id, contents_json="[]"))
        added.append({"epc": epc, "container_id": c.id, "container_code": c.container_code})

    scan_session.status = "FINISHED"
    scan_session.finished_at = datetime.now(timezone.utc)
    db.commit()
    return PackingScanResult(added=added, duplicates=duplicates,
                             unknown_epcs=unknown, unavailable=unavailable)


@router.patch("/packing-sessions/{session_id}/items/{container_id}")
def set_contents(session_id: str, container_id: str,
                 payload: PackingItemContentsIn,
                 user: User = Depends(require_roles(*PACK_ROLES)),
                 db: Session = Depends(get_db)):
    item = db.query(PackingItem).filter(
        PackingItem.session_id == session_id,
        PackingItem.container_id == container_id,
    ).first()
    if not item:
        raise HTTPException(404, "Item not found in this session")
    item.contents_json = json.dumps(payload.contents)
    db.commit()
    return {"container_id": container_id, "contents": payload.contents}


@router.post("/packing-sessions/{session_id}/complete")
def complete_packing(session_id: str,
                     user: User = Depends(require_roles(*PACK_ROLES)),
                     db: Session = Depends(get_db)):
    order = order_flow.complete_packing(db, session_id, user)
    return {"order_id": order.id, "status": order.status}


@router.delete("/packing-sessions/{session_id}/items/{container_id}")
def remove_item(session_id: str, container_id: str,
                user: User = Depends(require_roles(*PACK_ROLES)),
                db: Session = Depends(get_db)):
    """Undo a scan: take a container out of an open session and free it again."""
    session = db.get(PackingSession, session_id)
    if not session or session.status != "OPEN":
        raise HTTPException(409, "Session not open")
    item = db.query(PackingItem).filter(
        PackingItem.session_id == session_id,
        PackingItem.container_id == container_id,
    ).first()
    if not item:
        raise HTTPException(404, "Item not found in this session")
    c = db.get(Container, container_id)
    if c and c.status == "PACKING":
        db.add(ContainerMovement(
            container_id=c.id, from_status=c.status, to_status="AVAILABLE",
            from_location_id=c.current_location_id,
            to_location_id=c.current_location_id,
            reason="PACKING_REMOVED", reference_type="PACKING_SESSION",
            reference_id=session.id, actor_id=user.id,
        ))
        c.status = "AVAILABLE"
    db.delete(item)
    db.commit()
    return {"container_id": container_id, "removed": True}
