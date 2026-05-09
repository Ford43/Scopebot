import os
import uuid
<<<<<<< HEAD
=======
import time
>>>>>>> master
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
<<<<<<< HEAD
=======
        system_prompt=body.system_prompt,
>>>>>>> master
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
    bot = _get_bot_or_404(bot_id, db, current_user)

    # ลบโฟลเดอร์เอกสาร
    folder = os.path.join(UPLOAD_BASE, bot_id)
    if os.path.exists(folder):
        shutil.rmtree(folder)

    # ลบ vector DB
    vdb = os.path.join("vector_db", bot_id)
    if os.path.exists(vdb):
        shutil.rmtree(vdb)

    db.delete(bot)
    db.commit()
<<<<<<< HEAD
    return {"message": f"ลบ Bot {bot_id} เรียบร้อย"}
=======
    # 1. สร้างฟังก์ชันย่อยสำหรับบังคับลบโฟลเดอร์พร้อม retry
    def force_delete_folder(folder_path):
        if not os.path.exists(folder_path):
            return
            
        max_retries = 3
        for attempt in range(max_retries):
            try:
                shutil.rmtree(folder_path)
                print(f"Deleted folder: {folder_path}")
                break # ลบสำเร็จ ออกจาก loop
            except PermissionError as e:
                print(f"Attempt {attempt + 1}: Cannot delete {folder_path} yet ({e}). Waiting...")
                time.sleep(1) # รอ 1 วินาทีแล้วลองใหม่
            except Exception as e:
                print(f"Error deleting {folder_path}: {e}")
                break

    # 2. ทำการลบโฟลเดอร์ Data
    bot_data_dir = os.path.join("data", bot_id)
    force_delete_folder(bot_data_dir)

    # 3. ทำการลบโฟลเดอร์ Vector DB
    vdb = os.path.join("vector_db", bot_id)
    force_delete_folder(vdb)

    return {"message": "ลบบอทสำเร็จ"}
>>>>>>> master


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