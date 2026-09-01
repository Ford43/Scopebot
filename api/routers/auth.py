from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy.orm import Session

from api import auth, models, schemas
from api.database import get_db
from api.email_utils import send_password_reset_email, smtp_configured

router = APIRouter(prefix="/api/auth", tags=["Auth"])
logger = logging.getLogger("scopebot.auth")

RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "60"))


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _frontend_base_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _debug_mode() -> bool:
    return os.getenv("DEBUG", "false").lower() == "true"


@router.post("/register", response_model=schemas.UserOut)
def register(body: schemas.UserRegister, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email นี้ถูกใช้แล้ว")

    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username นี้ถูกใช้แล้ว")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร")

    user = models.User(
        email=body.email,
        username=body.username,
        hashed_password=auth.hash_password(body.password),
        role=models.UserRole.user,
        is_approved=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    admin_support_users = (
        db.query(models.User)
        .filter(models.User.role.in_([models.UserRole.admin, models.UserRole.support]))
        .all()
    )

    for staff in admin_support_users:
        db.add(
            models.Notification(
                user_id=staff.id,
                title="มีผู้สมัครสมาชิกใหม่",
                message=f"ผู้ใช้ {user.username} ({user.email}) สมัครสมาชิกใหม่และกำลังรอการอนุมัติ",
                type="warning",
            )
        )

    db.commit()
    return user


@router.post("/login", response_model=schemas.Token)
def login(body: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()

    if not user or not auth.verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email หรือ Password ไม่ถูกต้อง")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="บัญชีถูกระงับ")

    if not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="บัญชียังไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ",
        )

    token = auth.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/forgot-password")
def forgot_password(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Always return a generic success message (avoid email enumeration)."""
    generic = {
        "message": "หากอีเมลนี้มีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว",
    }

    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not user.is_active:
        return generic

    # Invalidate previous unused tokens
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({"used_at": datetime.now(timezone.utc)})

    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    db.add(
        models.PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_reset_token(raw_token),
            expires_at=expires_at,
        )
    )
    db.commit()

    reset_url = f"{_frontend_base_url()}/reset-password?token={raw_token}"
    emailed = False
    if smtp_configured():
        emailed = send_password_reset_email(user.email, reset_url)
    else:
        logger.warning(
            "Password reset for %s (SMTP not configured). Link: %s",
            user.email,
            reset_url,
        )
        # Notify admins so pilot IT can help without SMTP
        admins = (
            db.query(models.User)
            .filter(models.User.role == models.UserRole.admin, models.User.is_active == True)
            .all()
        )
        for admin in admins:
            db.add(
                models.Notification(
                    user_id=admin.id,
                    title="มีคำขอรีเซ็ตรหัสผ่าน",
                    message=(
                        f"ผู้ใช้ {user.username} ({user.email}) ขอรีเซ็ตรหัสผ่าน "
                        f"— ตั้งค่า SMTP หรือรีเซ็ตให้จากหน้าจัดการผู้ใช้"
                    ),
                    type="info",
                )
            )
        db.commit()

    # Pilot/dev convenience: expose link when DEBUG=true and email was not sent
    if _debug_mode() and not emailed:
        return {**generic, "dev_reset_url": reset_url, "email_sent": False}

    return {**generic, "email_sent": emailed}


@router.post("/reset-password")
def reset_password(body: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร")

    token_hash = _hash_reset_token(body.token.strip())
    now = datetime.now(timezone.utc)
    row = (
        db.query(models.PasswordResetToken)
        .filter(
            models.PasswordResetToken.token_hash == token_hash,
            models.PasswordResetToken.used_at.is_(None),
        )
        .first()
    )

    if not row:
        raise HTTPException(status_code=400, detail="ลิงก์รีเซ็ตไม่ถูกต้องหรือถูกใช้แล้ว")

    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(status_code=400, detail="ลิงก์รีเซ็ตหมดอายุแล้ว กรุณาขอใหม่")

    user = db.query(models.User).filter(models.User.id == row.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="ไม่พบบัญชีผู้ใช้")

    user.hashed_password = auth.hash_password(body.new_password)
    row.used_at = now
    db.commit()
    return {"message": "ตั้งรหัสผ่านใหม่สำเร็จ สามารถเข้าสู่ระบบได้"}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin")),
):
    return db.query(models.User).all()


@router.patch("/users/{user_id}/approve", response_model=schemas.UserOut)
def approve_user(
    user_id: int,
    body: schemas.ApproveUser,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")

    if (
        current_user.role == models.UserRole.support
        and user.role == models.UserRole.admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Support ไม่สามารถแก้ไขบัญชี Admin ได้",
        )

    if body.is_active is False and user.id == current_user.id:
        raise HTTPException(status_code=400, detail="ไม่สามารถระงับบัญชีของตัวเองได้")

    if body.is_approved is not None:
        user.is_approved = body.is_approved
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.max_bots is not None:
        user.max_bots = body.max_bots
    if body.role is not None:
        if current_user.role != models.UserRole.admin:
            raise HTTPException(
                status_code=403,
                detail="เฉพาะ Admin ที่เปลี่ยนบทบาทได้",
            )
        try:
            user.role = models.UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=400, detail="บทบาทไม่ถูกต้อง")

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin")),
):
    """ลบผู้ใช้ถาวร พร้อมบอท / เอกสาร / คิว live ที่เกี่ยวข้อง"""
    import os
    import shutil
    import time

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="ไม่สามารถลบบัญชีของตัวเองได้")

    if (
        current_user.role == models.UserRole.support
        and user.role == models.UserRole.admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Support ไม่สามารถลบบัญชี Admin ได้",
        )

    # Support ปฏิเสธได้เฉพาะคำขอที่ยังไม่อนุมัติ — ลบถาวรเป็นสิทธิ์ Admin
    if current_user.role == models.UserRole.support and user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="เฉพาะ Admin ที่ลบบัญชีถาวรได้ — Support ปฏิเสธได้เฉพาะคำขอที่ยังไม่อนุมัติ",
        )

    # บัญชีที่อนุมัติแล้วต้องระงับก่อน จึงจะลบถาวรได้ (คำขอ Pending ยังปฏิเสธ/ลบได้)
    if user.is_approved and user.is_active:
        raise HTTPException(
            status_code=400,
            detail="ต้องระงับบัญชีก่อน จึงจะลบผู้ใช้ได้",
        )

    if user.role == models.UserRole.admin:
        admin_count = (
            db.query(models.User)
            .filter(models.User.role == models.UserRole.admin)
            .count()
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="ไม่สามารถลบ Admin คนสุดท้ายในระบบได้",
            )

    def force_delete_folder(folder_path: str) -> None:
        if not os.path.exists(folder_path):
            return
        for _ in range(3):
            try:
                shutil.rmtree(folder_path)
                return
            except PermissionError:
                time.sleep(0.5)
            except Exception:
                return

    try:
        bots = list(user.bots or [])
        for bot in bots:
            # ลบ live sessions (+ messages) ก่อน เพื่อไม่ชน FK
            sessions = (
                db.query(models.LiveSession)
                .filter(models.LiveSession.bot_id == bot.id)
                .all()
            )
            for session in sessions:
                db.delete(session)

            bot.documents.clear()
            force_delete_folder(os.path.join("data", bot.bot_id))
            force_delete_folder(os.path.join("vector_db", bot.bot_id))
            db.delete(bot)

        # ลบเอกสารใน library + ไฟล์จริง
        for doc in list(user.documents or []):
            if doc.file_path and os.path.exists(doc.file_path):
                try:
                    os.remove(doc.file_path)
                except OSError:
                    pass
            db.delete(doc)

        # ลบ token reset password
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == user.id
        ).delete(synchronize_session=False)

        username = user.username
        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.exception("delete_user failed for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail=f"ลบผู้ใช้ไม่สำเร็จ: {e}")

    return {"message": f"ลบผู้ใช้ '{username}' สำเร็จ"}


class ChangePassword(PydanticBaseModel):
    old_password: str
    new_password: str


class AdminResetPassword(PydanticBaseModel):
    new_password: str


@router.patch("/change-password")
def change_password(
    body: ChangePassword,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not auth.verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="รหัสผ่านเดิมไม่ถูกต้อง")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร")

    current_user.hashed_password = auth.hash_password(body.new_password)
    db.commit()
    return {"message": "เปลี่ยนรหัสผ่านสำเร็จ"}


@router.patch("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    body: AdminResetPassword,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร")

    user.hashed_password = auth.hash_password(body.new_password)
    db.commit()
    return {"message": f"Reset password ของ {user.username} สำเร็จ"}
