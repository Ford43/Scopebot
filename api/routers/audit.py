from fastapi import APIRouter, Depends, Query
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
):
    total, rows = list_audit_logs(db, action=action, q=q, limit=limit, offset=offset)
    return {"total": total, "items": rows}
