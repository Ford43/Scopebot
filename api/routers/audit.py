from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from api import auth, models, schemas
from api.audit import list_audit_logs
from api.database import get_db

router = APIRouter(prefix="/api/audit-logs", tags=["Audit logs"])


@router.get("/", response_model=schemas.AuditLogListOut)
def get_audit_logs(
    action: str | None = Query(None),
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("admin")),
    account: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด")
    if date_to == date.max:
        raise HTTPException(422, "วันที่สิ้นสุดอยู่นอกช่วงที่รองรับ")
    total, rows = list_audit_logs(db, action=action, q=q, limit=limit, offset=offset,
                                account=account, date_from=date_from, date_to=date_to)
    return {"total": total, "items": rows}
