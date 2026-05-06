from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from pydantic import BaseModel as PydanticBaseModel

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=schemas.UserOut)
def register(body: schemas.UserRegister, db: Session = Depends(get_db)):
    # เช็ค email ซ้ำ
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email นี้ถูกใช้แล้ว")

    # เช็ค username ซ้ำ
    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username นี้ถูกใช้แล้ว")

    user = models.User(
        email=body.email,
        username=body.username,
        hashed_password=auth.hash_password(body.password),
        role=models.UserRole.user,
        is_approved=False  # รอ Support อนุมัติ
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # เพิ่มโค้ดส่วนนี้: ดึงรายชื่อ Admin และ Support เพื่อส่งแจ้งเตือน
    admin_support_users = db.query(models.User).filter(
        models.User.role.in_(["admin", "support"])
    ).all()

    # สร้าง Notification ยิงเข้ากระดิ่งให้ทุกคนที่มีสิทธิ์อนุมัติ
    for staff in admin_support_users:
        notif = models.Notification(
            user_id=staff.id,
            title="มีผู้สมัครสมาชิกใหม่",
            message=f"ผู้ใช้ {user.username} ({user.email}) สมัครสมาชิกใหม่และกำลังรอการอนุมัติ",
            type="warning" # ใช้ warning สีเหลืองจะได้สะดุดตา
        )
        db.add(notif)
    
    db.commit() # บันทึกแจ้งเตือนลงฐานข้อมูล

    return user


@router.post("/login", response_model=schemas.Token)
def login(body: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()

    if not user or not auth.verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email หรือ Password ไม่ถูกต้อง")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="บัญชีถูกระงับ")

    token = auth.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# --- Support/Admin เท่านั้น ---
@router.get("/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin"))
):
    return db.query(models.User).all()


@router.patch("/users/{user_id}/approve", response_model=schemas.UserOut)
def approve_user(
    user_id: int,
    body: schemas.ApproveUser,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role("support", "admin"))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")

    user.is_approved = body.is_approved
    if body.max_bots is not None:
        user.max_bots = body.max_bots
    db.commit()
    db.refresh(user)
    return user


class ChangePassword(PydanticBaseModel):
    old_password: str
    new_password: str

class AdminResetPassword(PydanticBaseModel):
    new_password: str


@router.patch("/change-password")
def change_password(
    body: ChangePassword,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
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
    current_user: models.User = Depends(auth.require_role("support", "admin"))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")

    user.hashed_password = auth.hash_password(body.new_password)
    db.commit()
    return {"message": f"Reset password ของ {user.username} สำเร็จ"}