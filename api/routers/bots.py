import os
import uuid
import time
import shutil
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

router = APIRouter(prefix="/api/bots", tags=["Bots"])

UPLOAD_BASE = "data"
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}
PROCESSING_STALE_AFTER = timedelta(minutes=3)


def _as_utc(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


def expire_stale_processing(bot: Optional[models.Bot], db: Session) -> Optional[models.Bot]:
    """If ingest hung, flip processing → inactive so the bot can be edited or deleted."""
    if bot is None or bot.status != models.BotStatus.processing:
        return bot
    ts = bot.updated_at or bot.created_at
    if ts is None:
        return bot
    if datetime.now(timezone.utc) - _as_utc(ts) < PROCESSING_STALE_AFTER:
        return bot
    bot.status = models.BotStatus.inactive
    db.commit()
    db.refresh(bot)
    return bot


def heal_bot_without_knowledge(bot: Optional[models.Bot], db: Session) -> Optional[models.Bot]:
    """Active/processing with zero documents cannot answer — keep status honest."""
    if bot is None or bot.status == models.BotStatus.inactive:
        return bot
    if bot.documents:
        return bot
    bot.status = models.BotStatus.inactive
    db.commit()
    db.refresh(bot)
    return bot


def normalize_bot_status(bot: Optional[models.Bot], db: Session) -> Optional[models.Bot]:
    return heal_bot_without_knowledge(expire_stale_processing(bot, db), db)


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
    return [
        normalize_bot_status(bot, db)
        for bot in auth.visible_bots_query(db, current_user, scope)
        .order_by(models.Bot.created_at.desc())
        .all()
    ]


@router.get("/{bot_id}", response_model=schemas.BotOut)
def get_bot(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    return normalize_bot_status(_get_bot_or_404(bot_id, db, current_user), db)


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


def _wipe_bot_files(bot_id_str: str) -> None:
    for folder_path in (
        os.path.join(UPLOAD_BASE, bot_id_str),
        os.path.join("vector_db", bot_id_str),
    ):
        if not os.path.exists(folder_path):
            continue
        for _ in range(8):
            try:
                shutil.rmtree(folder_path)
                break
            except PermissionError:
                time.sleep(1)
            except Exception:
                break


@router.delete("/{bot_id}")
def delete_bot(
    bot_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot_folder_id = bot.bot_id

    try:
        sessions = (
            db.query(models.LiveSession)
            .filter(models.LiveSession.bot_id == bot.id)
            .all()
        )
        for session in sessions:
            db.delete(session)

        bot.documents.clear()
        db.delete(bot)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"ลบบอทไม่สำเร็จ: {e}")

    background_tasks.add_task(_wipe_bot_files, bot_folder_id)
    return {"message": "ลบบอทสำเร็จ"}


@router.get("/{bot_id}/documents")
def list_documents(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    return bot.documents


@router.post("/{bot_id}/reindex")
def reindex_bot(
    bot_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator),
):
    """ลองประมวลผลเอกสารใหม่ เมื่อ ingest ค้างหรือพัง"""
    from api.routers.documents import _run_ingest_and_notify

    bot = _get_bot_or_404(bot_id, db, current_user)
    if not bot.documents:
        raise HTTPException(status_code=400, detail="ยังไม่มีเอกสารในบอทนี้")

    bot.status = models.BotStatus.processing
    db.commit()
    first_name = bot.documents[0].filename if bot.documents else "documents"
    background_tasks.add_task(
        _run_ingest_and_notify,
        bot.bot_id,
        bot.id,
        first_name,
        current_user.id,
    )
    return {"message": "กำลังประมวลผลเอกสารใหม่", "status": bot.status}


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
