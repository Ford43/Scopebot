import os
import uuid
import time
import shutil
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

router = APIRouter(prefix="/api/bots", tags=["Bots"])

UPLOAD_BASE = "data"
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".csv", ".json", ".html", ".md"}


def _get_bot_or_404(bot_id_str: str, db: Session, user: models.User):
    """Helper: ดึง bot และเช็คว่าเป็นของ user คนนี้"""
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id_str).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")
    if bot.owner_id != user.id and user.role == models.UserRole.user:
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง Bot นี้")
    return bot


# =====================
# CRUD Bot
# =====================
@router.post("/", response_model=schemas.BotOut)
def create_bot(
    body: schemas.BotCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
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
    current_user: models.User = Depends(auth.get_approved_user)
):
    # #region agent log
    import json as _json
    from pathlib import Path as _Path
    _log_path = _Path(__file__).resolve().parents[2] / "debug-c814d0.log"
    def _dbg(hypothesis_id, location, message, data=None, run_id="post-fix"):
        try:
            with open(_log_path, "a", encoding="utf-8") as _f:
                _f.write(_json.dumps({
                    "sessionId": "c814d0",
                    "runId": run_id,
                    "hypothesisId": hypothesis_id,
                    "location": location,
                    "message": message,
                    "data": data or {},
                    "timestamp": int(time.time() * 1000),
                }, ensure_ascii=False) + "\n")
        except Exception:
            pass
    # #endregion

    bot = _get_bot_or_404(bot_id, db, current_user)

    # #region agent log
    live_count = db.query(models.LiveSession).filter(models.LiveSession.bot_id == bot.id).count()
    conv_count = db.query(models.Conversation).filter(models.Conversation.bot_id == bot.id).count()
    doc_count = len(bot.documents) if bot.documents is not None else 0
    _dbg("B", "bots.py:delete_bot:start", "delete_bot started", {
        "bot_id": bot_id,
        "bot_pk": bot.id,
        "live_sessions": live_count,
        "conversations": conv_count,
        "documents": doc_count,
        "status": str(bot.status),
    })
    # #endregion

    def force_delete_folder(folder_path: str) -> None:
        if not os.path.exists(folder_path):
            return
        for attempt in range(3):
            try:
                shutil.rmtree(folder_path)
                return
            except PermissionError:
                time.sleep(1)
            except Exception as e:
                # #region agent log
                _dbg("D", "bots.py:force_delete_folder", "folder delete soft-fail", {
                    "folder": folder_path,
                    "error": str(e),
                    "attempt": attempt + 1,
                })
                # #endregion
                return

    try:
        # ลบ live sessions (+ messages ผ่าน cascade) ก่อน เพื่อไม่ชน FK live_sessions_bot_id_fkey
        sessions = (
            db.query(models.LiveSession)
            .filter(models.LiveSession.bot_id == bot.id)
            .all()
        )
        # #region agent log
        _dbg("B", "bots.py:delete_bot:clear_live", "deleting related live_sessions", {
            "count": len(sessions),
        })
        # #endregion
        for session in sessions:
            db.delete(session)

        # ตัดความสัมพันธ์เอกสาร (association) — ไม่ลบไฟล์ใน library กลาง
        bot.documents.clear()

        # ลบโฟลเดอร์ไฟล์/vector แบบ best-effort (อย่าให้ล็อกไฟล์บล็อกการลบ DB)
        force_delete_folder(os.path.join(UPLOAD_BASE, bot_id))
        force_delete_folder(os.path.join("vector_db", bot_id))
        # #region agent log
        _dbg("A", "bots.py:delete_bot:after_folders", "folder cleanup attempted", {
            "data": os.path.join(UPLOAD_BASE, bot_id),
            "vdb": os.path.join("vector_db", bot_id),
        })
        # #endregion

        # #region agent log
        _dbg("B", "bots.py:delete_bot:before_db_delete", "about to db.delete(bot)", {"bot_pk": bot.id})
        # #endregion
        db.delete(bot)
        db.commit()
        # #region agent log
        _dbg("E", "bots.py:delete_bot:after_commit", "db commit ok", {"bot_id": bot_id})
        # #endregion
    except Exception as e:
        # #region agent log
        _dbg("E", "bots.py:delete_bot:exception", "delete_bot failed", {
            "error_type": type(e).__name__,
            "error": str(e),
            "bot_id": bot_id,
        })
        # #endregion
        db.rollback()
        raise HTTPException(status_code=500, detail=f"ลบบอทไม่สำเร็จ: {e}")

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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot.is_line_connected = not bot.is_line_connected
    db.commit()
    return {"is_line_connected": bot.is_line_connected}


@router.post("/{bot_id}/toggle-web")
def toggle_web(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = _get_bot_or_404(bot_id, db, current_user)
    bot.is_web_connected = not bot.is_web_connected
    db.commit()
    return {"is_web_connected": bot.is_web_connected}