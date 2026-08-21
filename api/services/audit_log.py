from api.models import AuditLog

def create_audit_log(
    db,
    user=None,
    action="",
    target_type=None,
    target_id=None,
    detail=None,
    ip_address=None
):
    log = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else None,
        role=user.role.value if user else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        detail=detail,
        ip_address=ip_address
    )

    db.add(log)
    db.commit()