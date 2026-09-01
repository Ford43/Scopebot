import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from api.database import get_db, SessionLocal
from api import models, schemas, auth
from rag.ingest import ingest

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_BASE = "data/library"
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".csv", ".json", ".html", ".md"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


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
    category: str = "ทั่วไป",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    # เช็คนามสกุลไฟล์
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"ไฟล์ประเภท {ext or '(ไม่มีนามสกุล)'} ไม่รองรับ (รองรับ: {allowed})",
        )

    # เช็คชื่อไฟล์ซ้ำ
    existing = db.query(models.Document).filter(
        models.Document.filename == file.filename,
        models.Document.owner_id == current_user.id
    ).first()

    if existing:
        # หากมีไฟล์ชื่อนี้อยู่แล้วใน Library ของ User คนนี้
        # ให้ส่งข้อมูลไฟล์เดิมกลับไปเลย โดยไม่ต้องบันทึกใหม่และไม่เกิด Error
        return existing 

    # บันทึกไฟล์
    folder = os.path.join(UPLOAD_BASE, str(current_user.id))
    os.makedirs(folder, exist_ok=True)
    file_path = os.path.join(folder, file.filename)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"ไฟล์ใหญ่เกิน 10 MB (ขนาดปัจจุบัน {len(content) / (1024 * 1024):.1f} MB)",
        )

    with open(file_path, "wb") as f:
        f.write(content)

    # บันทึก metadata
    doc = models.Document(
        filename=file.filename,
        file_path=file_path,
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
    return query.order_by(models.Document.uploaded_at.desc()).all()


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


# =====================
# ลบเอกสาร (พร้อมแจ้งเตือน)
# =====================
@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    # เช็คว่าเอกสารนี้ถูกใช้โดย Bot กี่ตัว
    bot_count = len(doc.bots)
    bot_names = [b.name for b in doc.bots]

    # ลบไฟล์จริง
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

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
        raise HTTPException(status_code=400, detail="เอกสารนี้ถูก assign ให้ Bot นี้แล้ว")

    # copy ไฟล์ไปยังโฟลเดอร์ของ Bot
    bot_folder = os.path.join("data", bot_id)
    os.makedirs(bot_folder, exist_ok=True)
    dest_path = os.path.join(bot_folder, doc.filename)
    shutil.copy2(doc.file_path, dest_path)

    # เชื่อม relation
    bot.documents.append(doc)
    bot.status = models.BotStatus.processing
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

    # ลบไฟล์ออกจากโฟลเดอร์ Bot
    dest_path = os.path.join("data", bot_id, doc.filename)
    if os.path.exists(dest_path):
        os.remove(dest_path)

    # ตัด relation
    bot.documents.remove(doc)
    remaining = len(bot.documents)
    if remaining == 0:
        bot.status = models.BotStatus.inactive
    else:
        bot.status = models.BotStatus.processing
    db.commit()

    # แจ้งเตือน
    _create_notification(
        db, current_user.id,
        "ถอดเอกสารออกจาก Bot",
        f"ไฟล์ '{doc.filename}' ถูกถอดออกจาก Bot '{bot.name}' เรียบร้อยแล้ว",
        "info"
    )

    # rebuild vector index ให้ตรงกับเอกสารที่เหลือ
    if remaining > 0:
        background_tasks.add_task(
            _run_ingest_and_notify, bot_id, bot.id, doc.filename, current_user.id
        )
    else:
        # ไม่มีเอกสารเหลือ — เคลียร์ vector DB
        background_tasks.add_task(_clear_bot_vectors, bot_id)

    return {"message": f"ถอด '{doc.filename}' ออกจาก Bot '{bot.name}' สำเร็จ"}


def _clear_bot_vectors(bot_id_str: str):
    import shutil
    import gc
    try:
        import chromadb
        try:
            chromadb.api.client.SharedSystemClient.clear_system_cache()
        except Exception:
            pass
        gc.collect()
        persist_path = f"vector_db/{bot_id_str}"
        if os.path.exists(persist_path):
            shutil.rmtree(persist_path, ignore_errors=True)
    except Exception as e:
        print(f"clear vectors error for {bot_id_str}: {e}")


def _run_ingest_and_notify(bot_id_str: str, bot_db_id: int, filename: str, user_id: int):
    db = SessionLocal()
    try:
        ok = ingest(bot_id_str)
        bot = db.query(models.Bot).filter(models.Bot.id == bot_db_id).first()
        if not bot:
            return

        if ok:
            bot.status = models.BotStatus.active
            db.commit()
            _create_notification(
                db, user_id,
                "เพิ่มเอกสารให้ Bot สำเร็จ",
                f"ไฟล์ '{filename}' พร้อมใช้งานใน Bot แล้ว",
                "success",
            )
        else:
            bot.status = models.BotStatus.inactive
            db.commit()
            _create_notification(
                db, user_id,
                "ประมวลผลเอกสารไม่สำเร็จ",
                f"ไฟล์ '{filename}' ไม่สามารถสร้างฐานความรู้ได้ (ไม่มีเนื้อหาที่อ่านได้) — บอทยังไม่พร้อมใช้งาน",
                "warning",
            )
    except Exception as e:
        import traceback
        print(f"\n{'='*50}")
        print(f"❌ ERROR INGESTING FILE: {filename}")
        traceback.print_exc()
        print(f"{'='*50}\n")

        try:
            bot = db.query(models.Bot).filter(models.Bot.id == bot_db_id).first()
            if bot:
                bot.status = models.BotStatus.inactive
                db.commit()
            _create_notification(
                db, user_id,
                "เกิดข้อผิดพลาด",
                f"ไม่สามารถประมวลผลไฟล์ '{filename}' ได้: {str(e)}",
                "danger",
            )
        except Exception:
            db.rollback()
    finally:
        db.close()