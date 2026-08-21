from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from pydantic import BaseModel as PydanticBaseModel
import json
from api.services.audit_log import create_audit_log

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# =====================
# Helper — บันทึก Audit Log
# =====================
def write_audit_log(
    db: Session,
    user,
    action: str,
    target_type: str = None,
    target_id: str = None,
    detail: dict = None,
    ip: str = None
):
    log = models.AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else "system",
        role=str(user.role) if user else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        detail=json.dumps(detail, ensure_ascii=False) if detail else None,
        ip_address=ip
    )
    db.add(log)
    db.commit()


# =====================
# Register
# =====================
@router.post("/register", response_model=schemas.UserOut)
def register(body: schemas.UserRegister, request: Request, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email นี้ถูกใช้แล้ว")

    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username นี้ถูกใช้แล้ว")

    user = models.User(
        email=body.email,
        username=body.username,
        hashed_password=auth.hash_password(body.password),
        role=models.UserRole.user,
        is_approved=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # แจ้งเตือน Support/Admin ทุกคน
    admin_support_users = db.query(models.User).filter(
        models.User.role.in_(["admin", "support"])
    ).all()

    for staff in admin_support_users:
        db.add(models.Notification(
            user_id=staff.id,
            title="มีผู้สมัครสมาชิกใหม่",
            message=f"ผู้ใช้ {user.username} ({user.email}) สมัครสมาชิกใหม่และกำลังรอการอนุมัติ",
            type="warning"
        ))
    db.commit()

    # Audit Log
    write_audit_log(
        db=db, user=None,
        action="register",
        target_type="user",
        target_id=str(user.id),
        detail={"username": user.username, "email": user.email},
        ip=request.client.host
    )

    return user


# =====================
# Login
# =====================
@router.post("/login", response_model=schemas.Token)
def login(body: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()

    if not user or not auth.verify_password(body.password, user.hashed_password):
        # Log failed login
        write_audit_log(
            db=db, user=None,
            action="login_failed",
            target_type="user",
            detail={"email": body.email},
            ip=request.client.host
        )
        raise HTTPException(status_code=401, detail="Email หรือ Password ไม่ถูกต้อง")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="บัญชีถูกระงับ")

    token = auth.create_access_token({"sub": str(user.id)})

    # Audit Log
    write_audit_log(
        db=db, user=user,
        action="login",
        target_type="user",
        target_id=str(user.id),
        detail={"username": user.username},
        ip=request.client.host
    )

    return {"access_token": token, "token_type": "bearer"}


# =====================
# Me
# =====================
@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# =====================
# List Users (Support/Admin)
# =====================
@router.get("/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin"))
):
    return db.query(models.User).all()


# =====================
# Approve / Update User (Support/Admin)
# =====================
@router.patch("/users/{user_id}/approve", response_model=schemas.UserOut)
def approve_user(
    user_id: int,
    body: schemas.ApproveUser,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin"))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")

    # เก็บค่าก่อนแก้ไข
    changes = {}
    if body.is_approved is not None and body.is_approved != user.is_approved:
        changes["is_approved"] = {"before": user.is_approved, "after": body.is_approved}
        user.is_approved = body.is_approved

    if body.is_active is not None and body.is_active != user.is_active:
        changes["is_active"] = {"before": user.is_active, "after": body.is_active}
        user.is_active = body.is_active

    if body.max_bots is not None and body.max_bots != user.max_bots:
        changes["max_bots"] = {"before": user.max_bots, "after": body.max_bots}
        user.max_bots = body.max_bots

    if body.role is not None and body.role != user.role:
        changes["role"] = {"before": str(user.role), "after": str(body.role)}
        user.role = body.role

    db.commit()
    db.refresh(user)

    # กำหนด action ที่สื่อความหมาย
    if "is_approved" in changes:
        action = "approve_user" if changes["is_approved"]["after"] else "reject_user"
    elif "is_active" in changes:
        action = "activate_user" if changes["is_active"]["after"] else "suspend_user"
    elif "role" in changes:
        action = "change_role"
    else:
        action = "update_user"

    # Audit Log
    write_audit_log(
        db=db, user=current_user,
        action=action,
        target_type="user",
        target_id=str(user_id),
        detail={
            "target_username": user.username,
            "target_email": user.email,
            "changes": changes
        },
        ip=request.client.host
    )

    # แจ้งเตือน user ที่ถูกกระทำ
    notif_messages = {
        "approve_user": ("บัญชีได้รับการอนุมัติแล้ว", "บัญชีของคุณได้รับการอนุมัติ คุณสามารถเข้าใช้งานระบบได้แล้ว", "success"),
        "reject_user": ("บัญชีถูกปฏิเสธ", "บัญชีของคุณถูกปฏิเสธ กรุณาติดต่อ Support", "danger"),
        "suspend_user": ("บัญชีถูกระงับ", "บัญชีของคุณถูกระงับชั่วคราว กรุณาติดต่อ Support", "danger"),
        "activate_user": ("บัญชีถูกเปิดใช้งานแล้ว", "บัญชีของคุณถูกเปิดใช้งานแล้ว", "success"),
        "change_role": ("Role ของคุณถูกเปลี่ยน", f"Role ของคุณถูกเปลี่ยนเป็น {user.role}", "info"),
    }

    if action in notif_messages:
        title, message, notif_type = notif_messages[action]
        db.add(models.Notification(
            user_id=user.id,
            title=title,
            message=message,
            type=notif_type
        ))
        db.commit()

    return user


# =====================
# Change Password (ตัวเอง)
# =====================
class ChangePassword(PydanticBaseModel):
    old_password: str
    new_password: str


@router.patch("/change-password")
def change_password(
    body: ChangePassword,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not auth.verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="รหัสผ่านเดิมไม่ถูกต้อง")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร")

    current_user.hashed_password = auth.hash_password(body.new_password)
    db.commit()

    write_audit_log(
        db=db, user=current_user,
        action="change_password",
        target_type="user",
        target_id=str(current_user.id),
        detail={"username": current_user.username},
        ip=request.client.host
    )

    return {"message": "เปลี่ยนรหัสผ่านสำเร็จ"}


# =====================
# Reset Password (Support/Admin)
# =====================
class AdminResetPassword(PydanticBaseModel):
    new_password: str


@router.patch("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    body: AdminResetPassword,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin"))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร")

    user.hashed_password = auth.hash_password(body.new_password)
    db.commit()

    write_audit_log(
        db=db, user=current_user,
        action="reset_password",
        target_type="user",
        target_id=str(user_id),
        detail={"target_username": user.username},
        ip=request.client.host
    )

    # แจ้งเตือน user ที่ถูก reset
    db.add(models.Notification(
        user_id=user.id,
        title="รหัสผ่านถูก Reset",
        message=f"รหัสผ่านของคุณถูก Reset โดย {current_user.username} กรุณาเปลี่ยนรหัสผ่านทันที",
        type="warning"
    ))
    db.commit()

    return {"message": f"Reset password ของ {user.username} สำเร็จ"}


# =====================
# Audit Logs (Admin เท่านั้น)
# =====================
@router.get("/audit-logs")
def get_audit_logs(
    user_id: int = None,
    action: str = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("admin"))
):
    query = db.query(models.AuditLog)
    if user_id:
        query = query.filter(models.AuditLog.user_id == user_id)
    if action:
        query = query.filter(models.AuditLog.action == action)
    return query.order_by(
        models.AuditLog.created_at.desc()
    ).offset((page - 1) * limit).limit(limit).all()