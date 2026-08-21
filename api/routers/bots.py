import os
import uuid
import time
import shutil
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from api.routers.auth import write_audit_log

router = APIRouter(prefix="/api/bots", tags=["Bots"])

UPLOAD_BASE = "data"
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".csv", ".json", ".html", ".md"}


def _get_bot_or_404(bot_id_str: str, db: Session, user: models.User):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id_str).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")
    if bot.owner_id != user.id and user.role == models.UserRole.user:
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง Bot นี้")
    return bot


def _force_delete_folder(folder_path: str):
    """ลบโฟลเดอร์พร้อม retry สำหรับ Windows"""
    if not os.path.exists(folder_path):
        return
    for attempt in range(3):
        try:
            shutil.rmtree(folder_path)
            break
        except PermissionError:
            time.sleep(1)
        except Exception as e:
            print(f"Error deleting {folder_path}: {e}")
            break


# =====================
# CRUD Bot
# =====================
@router.post("/", response_model=schemas.BotOut)
def create_bot(
    body: schemas.BotCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot_count = db.query(models.Bot).filter(models.Bot.owner_id == current_user.id).count()
    if bot_count >= current_user.max_bots:
        raise HTTPException(status_code=400, detail=f"ถึงจำนวนสูงสุดแล้ว ({current_user.max_bots} Bot)")

    bot_id_str = f"bot_{uuid.uuid4().hex[:8]}"
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

    write_audit_log(
        db=db, user=current_user,
        action="create_bot",
        target_type="bot",
        target_id=bot_id_str,
        detail={"bot_name": body.name},
        ip=request.client.host
    )

    return bot


@router.get("/", response_model=list[schemas.BotOut])
def list_my_bots(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    if current_user.role == models.UserRole.admin:
        return db.query(models.Bot).all()
    return db.query(models.Bot).filter(models.Bot.owner_id == current_user.id).all()


@router.get("/{bot_id}", response_model=schemas.BotOut)
def get_bot(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    return _get_bot_or_404(bot_id, db, current_user)


@router.patch("/{bot_id}", response_model=schemas.BotOut)
def update_bot(
    bot_id: str,
    body: schemas.BotUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    changes = {}
    for field, value in body.dict(exclude_unset=True).items():
        old_val = getattr(bot, field, None)
        if old_val != value:
            # ไม่เก็บ token/secret ลง log
            if "token" not in field and "secret" not in field:
                changes[field] = {"before": str(old_val), "after": str(value)}
            setattr(bot, field, value)

    db.commit()
    db.refresh(bot)

    write_audit_log(
        db=db, user=current_user,
        action="update_bot",
        target_type="bot",
        target_id=bot_id,
        detail={"bot_name": bot.name, "changes": changes},
        ip=request.client.host
    )

    return bot


@router.delete("/{bot_id}")
def delete_bot(
    bot_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot_name = bot.name

    db.delete(bot)
    db.commit()

    # ลบโฟลเดอร์ (ครั้งเดียว ด้วย retry)
    _force_delete_folder(os.path.join("data", bot_id))
    _force_delete_folder(os.path.join("vector_db", bot_id))

    write_audit_log(
        db=db, user=current_user,
        action="delete_bot",
        target_type="bot",
        target_id=bot_id,
        detail={"bot_name": bot_name},
        ip=request.client.host
    )

    return {"message": "ลบบอทสำเร็จ"}


@router.get("/{bot_id}/documents")
def list_documents(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    return bot.documents


# =====================
# Toggle Connection
# =====================
@router.post("/{bot_id}/toggle-line")
def toggle_line(
    bot_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot.is_line_connected = not bot.is_line_connected
    db.commit()

    write_audit_log(
        db=db, user=current_user,
        action="toggle_line",
        target_type="bot",
        target_id=bot_id,
        detail={"bot_name": bot.name, "is_line_connected": bot.is_line_connected},
        ip=request.client.host
    )

    return {"is_line_connected": bot.is_line_connected}


@router.post("/{bot_id}/toggle-web")
def toggle_web(
    bot_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot.is_web_connected = not bot.is_web_connected
    db.commit()

    write_audit_log(
        db=db, user=current_user,
        action="toggle_web",
        target_type="bot",
        target_id=bot_id,
        detail={"bot_name": bot.name, "is_web_connected": bot.is_web_connected},
        ip=request.client.host
    )

    return {"is_web_connected": bot.is_web_connected}