import os
import uuid
import time
import shutil
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/api/bots", tags=["Bots"])

UPLOAD_BASE = "data"
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".csv", ".json", ".html", ".md"}


def _get_bot_or_404(bot_id_str: str, db: Session, user: models.User):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id_str).first()
    return auth.assert_bot_access(user, bot)


# =====================
# CRUD Bot
# =====================
@router.post("/", response_model=schemas.BotOut)
def create_bot(
    body: schemas.BotCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    # เช็คจำนวน Bot ที่มีอยู่
    bot_count = db.query(models.Bot).filter(models.Bot.owner_id == current_user.id).count()
    if bot_count >= current_user.max_bots:
        raise HTTPException(status_code=400, detail=f"ถึงจำนวนสูงสุดแล้ว ({current_user.max_bots} Bot)")

    # สร้าง bot_id แบบ unique (ใช้เป็นชื่อโฟลเดอร์ด้วย)
    bot_id_str = f"bot_{uuid.uuid4().hex[:8]}"

    # สร้างโฟลเดอร์สำหรับเก็บเอกสาร
    os.makedirs(os.path.join(UPLOAD_BASE, bot_id_str), exist_ok=True)

    bot = models.Bot(
        bot_id=bot_id_str,
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
        owner_id=current_user.id
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


@router.get("/", response_model=list[schemas.BotOut])
def list_my_bots(
    scope: str = "all",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    return auth.visible_bots_query(db, current_user, scope).order_by(models.Bot.created_at.desc()).all()


@router.get("/{bot_id}", response_model=schemas.BotOut)
def get_bot(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    return _get_bot_or_404(bot_id, db, current_user)


@router.patch("/{bot_id}", response_model=schemas.BotOut)
def update_bot(
    bot_id: str,
    body: schemas.BotUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    for field, value in body.dict(exclude_unset=True).items():
        setattr(bot, field, value)
    db.commit()
    db.refresh(bot)
    return bot


@router.delete("/{bot_id}")
def delete_bot(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = _get_bot_or_404(bot_id, db, current_user)

    def force_delete_folder(folder_path: str) -> None:
        if not os.path.exists(folder_path):
            return
        for _ in range(3):
            try:
                shutil.rmtree(folder_path)
                return
            except PermissionError:
                time.sleep(1)
            except Exception:
                return

    try:
        # ลบ live sessions (+ messages ผ่าน cascade) ก่อน เพื่อไม่ชน FK live_sessions_bot_id_fkey
        sessions = (
            db.query(models.LiveSession)
            .filter(models.LiveSession.bot_id == bot.id)
            .all()
        )
        for session in sessions:
            db.delete(session)

        # ตัดความสัมพันธ์เอกสาร (association) — ไม่ลบไฟล์ใน library กลาง
        bot.documents.clear()

        # ลบโฟลเดอร์ไฟล์/vector แบบ best-effort (อย่าให้ล็อกไฟล์บล็อกการลบ DB)
        force_delete_folder(os.path.join(UPLOAD_BASE, bot_id))
        force_delete_folder(os.path.join("vector_db", bot_id))

        db.delete(bot)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"ลบบอทไม่สำเร็จ: {e}")

    return {"message": "ลบบอทสำเร็จ"}


@router.get("/{bot_id}/documents")
def list_documents(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    return bot.documents


# =====================
# Toggle Connection
# =====================
@router.post("/{bot_id}/toggle-line")
def toggle_line(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot.is_line_connected = not bot.is_line_connected
    db.commit()
    return {"is_line_connected": bot.is_line_connected}


@router.post("/{bot_id}/toggle-web")
def toggle_web(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot.is_web_connected = not bot.is_web_connected
    db.commit()
    return {"is_web_connected": bot.is_web_connected}
