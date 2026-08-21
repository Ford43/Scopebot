from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from api.database import get_db
from api import models, auth

router = APIRouter(prefix="/api/bots", tags=["Bot Settings"])


def _get_bot_or_404(bot_id_str: str, db: Session, user: models.User) -> models.Bot:
    """ดึง Bot ตาม bot_id พร้อมตรวจสิทธิ์ความเป็นเจ้าของ (เหมือน pattern ใน bots.py)"""
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id_str).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")
    if bot.owner_id != user.id and user.role == models.UserRole.user:
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง Bot นี้")
    return bot


# Pydantic Models สำหรับรับข้อมูล JSON
class LineCredentialsUpdate(BaseModel):
    line_channel_token: str
    line_channel_secret: str


class IntegrationStatusUpdate(BaseModel):
    line_enabled: bool


@router.put("/{bot_id}/line-credentials")
def update_line_credentials(
    bot_id: str,
    creds: LineCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    รับ API Call จากหน้า Integration (Frontend) เพื่ออัปเดต Token ของบอทตัวนั้นๆ
    """
    bot = _get_bot_or_404(bot_id, db, current_user)

    # อัปเดตข้อมูลลง Database
    bot.line_channel_token = creds.line_channel_token
    bot.line_channel_secret = creds.line_channel_secret

    # เมื่อใส่ข้อมูลครบ ถือว่าพร้อมเปิดการเชื่อมต่อ LINE
    bot.is_line_connected = True

    db.commit()
    db.refresh(bot)

    return {
        "status": "success",
        "message": "บันทึกการตั้งค่า LINE สำเร็จ",
    }


@router.get("/{bot_id}/line-credentials")
def get_line_credentials(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    bot = _get_bot_or_404(bot_id, db, current_user)

    return {
        "is_connected": bot.is_line_connected,
        "channel_token": bot.line_channel_token or "",
        "channel_secret": bot.line_channel_secret or "",
    }


@router.put("/{bot_id}/integration-status")
def update_integration_status(
    bot_id: str,
    payload: IntegrationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """เปิด/ปิดการเชื่อมต่อ LINE ของบอท (ปุ่ม Toggle ในหน้า Integration)"""
    bot = _get_bot_or_404(bot_id, db, current_user)

    if payload.line_enabled and (not bot.line_channel_token or not bot.line_channel_secret):
        raise HTTPException(
            status_code=400,
            detail="กรุณาตั้งค่า Channel Token และ Channel Secret ก่อนเปิดใช้งาน",
        )

    bot.is_line_connected = payload.line_enabled
    db.commit()
    db.refresh(bot)

    return {"status": "success", "is_connected": bot.is_line_connected}


@router.post("/{bot_id}/test-line")
def test_line_connection(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """ทดสอบว่า Channel Access Token ที่บันทึกไว้ใช้งานได้จริงกับ LINE API"""
    bot = _get_bot_or_404(bot_id, db, current_user)

    if not bot.line_channel_token or not bot.line_channel_secret:
        return {"status": "failed", "message": "ยังไม่ได้ตั้งค่า Channel Token/Secret"}

    try:
        from linebot.v3.messaging import Configuration, ApiClient, MessagingApi

        configuration = Configuration(access_token=bot.line_channel_token)
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            bot_info = line_bot_api.get_bot_info()

        return {
            "status": "connected",
            "message": f"เชื่อมต่อสำเร็จ (LINE OA: {getattr(bot_info, 'display_name', bot.name)})",
        }
    except Exception as e:
        return {"status": "failed", "message": f"Token ไม่ถูกต้องหรือหมดอายุ: {e}"}