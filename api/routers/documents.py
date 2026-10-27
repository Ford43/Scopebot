import os
import shutil
import uuid
import logging
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from api.knowledge import request_update, run_update, state_lock, knowledge_mutation

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_BASE = "data/library"
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}
ALLOWED_EXTENSIONS_LABEL = "PDF, DOCX, TXT, CSV"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
logger = logging.getLogger(__name__)


def _validated_filename(filename: str) -> str:
    # Reject paths on both Windows and POSIX, including drive-relative paths
    # and alternate data streams. Keep the display name separate from storage.
    if (not filename or len(filename) > 255 or filename in {".", ".."}
            or filename.endswith((" ", "."))
            or any(c in filename for c in '/\\:<>"|?*')
            or any(ord(c) < 32 for c in filename)
            or filename.split(".")[0].upper() in {
                "CON", "PRN", "AUX", "NUL",
                *{f"COM{i}" for i in range(1, 10)},
                *{f"LPT{i}" for i in range(1, 10)},
            }):
        raise HTTPException(status_code=400, detail="ชื่อไฟล์ไม่ถูกต้อง กรุณาใช้ชื่อไฟล์ที่ไม่มีพาธหรืออักขระพิเศษ")
    return filename


def _contained_path(folder, filename: str) -> Path:
    root = Path(folder).resolve()
    path = (root / _validated_filename(filename)).resolve()
    if not path.is_relative_to(root):
        raise HTTPException(status_code=400, detail="ตำแหน่งไฟล์ไม่ถูกต้อง")
    return path


def _library_folder(user_id: int) -> Path:
    return _contained_path(UPLOAD_BASE, str(user_id))


def _bot_copy_path(bot_id: str, filename: str) -> Path:
    # Persisted names may predate the portable upload-name rules (e.g. ':' on
    # Linux). Permit cleanup of these names, but never follow paths/symlinks out
    # of this bot's directory. New uploads still use _validated_filename.
    root = _contained_path("data", bot_id)
    path = (root / filename).resolve()
    if path.parent != root:
        raise HTTPException(status_code=400, detail="ตำแหน่งไฟล์ไม่ถูกต้อง")
    return path


def _replace_document(doc, file_path, category, size, db):
    """Stage every copy first, and restore originals if installation/commit fails."""
    staged = []
    installed = []
    try:
        for bot in doc.bots:
            dest = _bot_copy_path(bot.bot_id, doc.filename)
            dest.parent.mkdir(parents=True, exist_ok=True)
            temp = dest.with_name(f".{uuid.uuid4().hex}.tmp")
            staged.append((dest, temp))
            shutil.copy2(file_path, temp)
        for dest, temp in staged:
            backup = dest.with_name(f".{uuid.uuid4().hex}.backup") if dest.exists() else None
            if backup:
                os.replace(dest, backup)
            installed.append((dest, backup))
            os.replace(temp, dest)
        doc.file_path = str(file_path)
        doc.file_size = size
        doc.category = category
        for bot in doc.bots:
            request_update(bot, destructive=True)
        db.commit()
    except Exception:
        db.rollback()
        for dest, backup in reversed(installed):
            if backup:
                os.replace(backup, dest)
            else:
                dest.unlink(missing_ok=True)
        file_path.unlink(missing_ok=True)
        raise
    finally:
        for _, temp in staged:
            temp.unlink(missing_ok=True)
    for _, backup in installed:
        if backup:
            try:
                backup.unlink(missing_ok=True)
            except OSError:
                logger.warning("Could not remove document backup %s", backup)


def _create_notification(db: Session, user_id: int, title: str, message: str, type: str = "info"):
    """Helper สร้าง notification"""
    notif = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type
    )
    db.add(notif)
    db.commit()


# =====================
# อัปโหลดเอกสารเข้า Library กลาง
# =====================
@router.post("/upload", response_model=schemas.DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form("ทั่วไป"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator),
    replace_existing: Annotated[bool, Form()] = False,
):
    filename = _validated_filename(file.filename or "")
    # เช็คนามสกุลไฟล์
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"ไฟล์ประเภท {ext or '(ไม่มีนามสกุล)'} ไม่รองรับ (รองรับ: {ALLOWED_EXTENSIONS_LABEL})",
        )

    # Finish asynchronous I/O before acquiring a row lock: waiting on another
    # upload must not block the event loop while the lock holder awaits a read.
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="ไฟล์ใหญ่เกิน 10 MB")

    with state_lock():
        # A document row may not exist yet. Lock its existing owner first so two
        # concurrent PostgreSQL uploads cannot both insert the same new filename.
        db.query(models.User).filter(models.User.id == current_user.id).with_for_update().one()

        # เช็คชื่อไฟล์ซ้ำ
        existing = db.query(models.Document).filter(
            models.Document.filename == filename,
            models.Document.owner_id == current_user.id
        ).with_for_update().first()

        category = (category or "ทั่วไป").strip()[:40] or "ทั่วไป"

        if existing and not replace_existing:
            raise HTTPException(status_code=409, detail={
                "code": "document_exists",
                "message": "มีเอกสารชื่อนี้แล้ว ต้องยืนยันก่อนแทนที่เนื้อหา",
                "assigned_bots": [b.name for b in existing.bots],
            })

        # บันทึกไฟล์
        folder = _library_folder(current_user.id)
        file_path = _contained_path(folder, f"{uuid.uuid4().hex}{ext}")
        folder.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(content)

        if existing:
            old_path = Path(existing.file_path).resolve()
            _replace_document(existing, file_path, category, len(content), db)
            db.refresh(existing)
            for bot in existing.bots:
                background_tasks.add_task(_run_ingest_and_notify, bot.bot_id, bot.id, filename, current_user.id)
            if old_path.is_relative_to(folder.resolve()) and old_path != file_path:
                try:
                    old_path.unlink(missing_ok=True)
                except OSError:
                    logger.warning("Could not remove superseded library file %s", old_path)
            return existing

        # บันทึก metadata
        doc = models.Document(
            filename=filename,
            file_path=str(file_path),
            file_size=len(content),
            category=category,
            owner_id=current_user.id
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # แจ้งเตือน
        background_tasks.add_task(
            _create_notification, db, current_user.id,
            "อัปโหลดเอกสารสำเร็จ",
            f"ไฟล์ '{file.filename}' ถูกเพิ่มเข้า Library เรียบร้อยแล้ว",
            "success"
        )

        return doc


# =====================
# ดูเอกสารทั้งหมดของตัวเอง
# =====================
@router.get("/", response_model=list[schemas.DocumentOut])
def list_documents(
    category: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    query = db.query(models.Document).filter(
        models.Document.owner_id == current_user.id
    )
    if category:
        query = query.filter(models.Document.category == category)
    docs = query.order_by(models.Document.uploaded_at.desc()).all()
    return [
        schemas.DocumentOut(
            id=d.id,
            filename=d.filename,
            file_size=d.file_size,
            category=d.category,
            owner_id=d.owner_id,
            uploaded_at=d.uploaded_at,
            assigned_bots=[b.name for b in d.bots],
        )
        for d in docs
    ]


# =====================
# ดู categories ทั้งหมด
# =====================
@router.get("/categories")
def list_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    results = db.query(models.Document.category).filter(
        models.Document.owner_id == current_user.id
    ).distinct().all()
    return [r[0] for r in results if r[0]]


# =====================
# แก้ไข category เอกสาร
# =====================
@router.patch("/{doc_id}", response_model=schemas.DocumentOut)
def update_document(
    doc_id: int,
    body: schemas.DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    if body.category is not None:
        doc.category = body.category
    db.commit()
    db.refresh(doc)
    return doc


def _remove_bot_copy(bot_id_str: str, filename: str) -> None:
    dest_path = _bot_copy_path(bot_id_str, filename)
    if os.path.exists(dest_path):
        os.remove(dest_path)


def _sync_bot_knowledge_after_doc_change(
    bot: models.Bot,
    filename: str,
    user_id: int,
    background_tasks: BackgroundTasks,
) -> None:
    request_update(bot, destructive=True)
    if bot.documents:
        background_tasks.add_task(
            _run_ingest_and_notify, bot.bot_id, bot.id, filename, user_id
        )



def _purge_document_from_assigned_bots(
    doc: models.Document,
    user_id: int,
    background_tasks: BackgroundTasks,
) -> list[str]:
    """Detach copies and invalidate removed content before scheduling a rebuild."""
    assigned = list(doc.bots)
    bot_names = [b.name for b in assigned]
    filename = doc.filename
    for bot in assigned:
        _remove_bot_copy(bot.bot_id, filename)
        if doc in bot.documents:
            bot.documents.remove(doc)
        _sync_bot_knowledge_after_doc_change(bot, filename, user_id, background_tasks)
    return bot_names


# =====================
# ลบเอกสาร (พร้อมแจ้งเตือน)
# =====================
@router.delete("/{doc_id}")
@knowledge_mutation
def delete_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    bot_names = _purge_document_from_assigned_bots(
        doc, current_user.id, background_tasks
    )
    bot_count = len(bot_names)

    library_path = Path(doc.file_path).resolve()
    if library_path.is_relative_to(_library_folder(current_user.id)):
        library_path.unlink(missing_ok=True)

    filename = doc.filename
    db.delete(doc)
    db.commit()

    # แจ้งเตือน
    if bot_count > 0:
        _create_notification(
            db, current_user.id,
            "ลบเอกสารที่ Bot กำลังใช้งาน",
            f"ไฟล์ '{filename}' ถูกลบออกจาก {bot_count} Bot ได้แก่ {', '.join(bot_names)}",
            "warning"
        )
    else:
        _create_notification(
            db, current_user.id,
            "ลบเอกสารสำเร็จ",
            f"ไฟล์ '{filename}' ถูกลบออกจาก Library เรียบร้อยแล้ว",
            "info"
        )

    return {
        "message": f"ลบ '{filename}' สำเร็จ",
        "affected_bots": bot_names
    }


# =====================
# กำหนดเอกสารให้ Bot
# =====================
@router.post("/{doc_id}/assign/{bot_id}")
@knowledge_mutation
def assign_to_bot(
    doc_id: int,
    bot_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    bot = db.query(models.Bot).filter(
        models.Bot.bot_id == bot_id,
        models.Bot.owner_id == current_user.id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    # เช็คว่า assign แล้วหรือยัง
    if doc in bot.documents:
        return {"message": "เอกสารนี้อยู่ในบอทแล้ว"}

    # copy ไฟล์ไปยังโฟลเดอร์ของ Bot
    dest_path = _bot_copy_path(bot_id, doc.filename)
    source_path = Path(doc.file_path).resolve()
    if not source_path.is_relative_to(_library_folder(current_user.id)):
        raise HTTPException(status_code=400, detail="ตำแหน่งเอกสารไม่ถูกต้อง กรุณาอัปโหลดใหม่")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, dest_path)

    # เชื่อม relation
    bot.documents.append(doc)
    request_update(bot)
    db.commit()

    # รัน ingest ใน background (ใช้ Session ใหม่ — อย่าใช้ request session)
    background_tasks.add_task(
        _run_ingest_and_notify, bot_id, bot.id, doc.filename, current_user.id
    )

    return {"message": f"กำหนด '{doc.filename}' ให้ Bot '{bot.name}' เรียบร้อย กำลัง ingest..."}


# =====================
# ถอด เอกสารออกจาก Bot
# =====================
@router.delete("/{doc_id}/unassign/{bot_id}")
@knowledge_mutation
def unassign_from_bot(
    doc_id: int,
    bot_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    bot = db.query(models.Bot).filter(
        models.Bot.bot_id == bot_id,
        models.Bot.owner_id == current_user.id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    if doc not in bot.documents:
        raise HTTPException(status_code=400, detail="เอกสารนี้ไม่ได้ถูก assign ให้ Bot นี้")

    _remove_bot_copy(bot_id, doc.filename)
    bot.documents.remove(doc)
    _sync_bot_knowledge_after_doc_change(
        bot, doc.filename, current_user.id, background_tasks
    )
    db.commit()

    _create_notification(
        db, current_user.id,
        "ถอดเอกสารออกจาก Bot",
        f"ไฟล์ '{doc.filename}' ถูกถอดออกจาก Bot '{bot.name}' เรียบร้อยแล้ว",
        "info"
    )

    return {"message": f"ถอด '{doc.filename}' ออกจาก Bot '{bot.name}' สำเร็จ"}


def _clear_bot_vectors(bot_id_str: str):
    """Legacy hook: indexes are retained to avoid deleting files held by readers.

    Detaching documents invalidates access transactionally via knowledge_blocked.
    """
    return None


def _run_ingest_and_notify(bot_id_str: str, bot_db_id: int, filename: str, user_id: int):
    run_update(bot_id_str, bot_db_id, filename, user_id)
