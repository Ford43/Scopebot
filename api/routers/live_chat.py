from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from linebot.v3.messaging import (
    Configuration, ApiClient, MessagingApi,
    PushMessageRequest, TextMessage
)

router = APIRouter(prefix="/api/live", tags=["Live Chat"])


def _push_line_message(token: str, line_user_id: str, text: str):
    """ส่งข้อความหาลูกค้าผ่าน Line Push Message"""
    try:
        # normalize line break ก่อนส่ง
        text = text.replace("\\n", "\n").replace("\r\n", "\n").replace("\r", "\n")
        configuration = Configuration(access_token=token)
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.push_message(
                PushMessageRequest(
                    to=line_user_id,
                    messages=[TextMessage(text=text)]
                )
            )
    except Exception as e:
        print(f"❌ Push message error: {e}")


def _get_or_create_session(db: Session, line_user_id: str, bot_db_id: int, display_name: str = None):
    """ดึง session ที่ active อยู่ หรือสร้างใหม่"""
    session = db.query(models.LiveSession).filter(
        models.LiveSession.line_user_id == line_user_id,
        models.LiveSession.bot_id == bot_db_id,
        models.LiveSession.is_active == True
    ).first()

    if not session:
        session = models.LiveSession(
            line_user_id=line_user_id,
            line_display_name=display_name,
            bot_id=bot_db_id,
            mode=models.SessionMode.bot
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    return session


def _enrich_session(session: models.LiveSession, db: Session) -> dict:
    """เพิ่มข้อมูล bot และคำถามล่าสุดเข้าไปใน session"""
    bot = db.query(models.Bot).filter(models.Bot.id == session.bot_id).first()

    last_unanswered = db.query(models.Conversation).filter(
        models.Conversation.bot_id == session.bot_id,
        models.Conversation.session_id == session.line_user_id,
        models.Conversation.is_answered_by_bot == False
    ).order_by(models.Conversation.created_at.desc()).first()

    return {
        "id": session.id,
        "line_user_id": session.line_user_id,
        "line_display_name": session.line_display_name,
        "bot_id": session.bot_id,
        "bot_name": bot.name if bot else None,
        "bot_description": bot.description if bot else None,
        "mode": session.mode,
        "is_active": session.is_active,
        "started_at": session.started_at,
        "messages": session.messages,
        "last_question": last_unanswered.question if last_unanswered else None
    }


@router.get("/sessions")
def list_sessions(
    bot_id: str = None,
    mode: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    query = db.query(models.LiveSession).filter(
        models.LiveSession.is_active == True
    )

    if bot_id:
        bot = db.query(models.Bot).filter(
            models.Bot.bot_id == bot_id,
            models.Bot.owner_id == current_user.id
        ).first()
        if bot:
            query = query.filter(models.LiveSession.bot_id == bot.id)

    if mode:
        query = query.filter(models.LiveSession.mode == mode)

    sessions = query.order_by(models.LiveSession.started_at.desc()).all()
    return [_enrich_session(s, db) for s in sessions]


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    session = db.query(models.LiveSession).filter(
        models.LiveSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="ไม่พบ session")
    return _enrich_session(session, db)


# =====================
# เจ้าหน้าที่ตอบลูกค้า → ส่งผ่าน Line Push
# =====================
@router.post("/sessions/{session_id}/reply")
def staff_reply(
    session_id: int,
    body: schemas.StaffReply,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    session = db.query(models.LiveSession).filter(
        models.LiveSession.id == session_id,
        models.LiveSession.is_active == True
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="ไม่พบ session")

    if session.mode not in [models.SessionMode.human, models.SessionMode.waiting]:
        raise HTTPException(status_code=400, detail="session นี้ยังไม่ได้อยู่ใน mode human")

    # อัปเดต mode เป็น human ถ้ายังเป็น waiting
    if session.mode == models.SessionMode.waiting:
        session.mode = models.SessionMode.human
        db.commit()

    # normalize line break ก่อนบันทึก
    clean_message = body.message.replace("\\n", "\n").replace("\r\n", "\n").replace("\r", "\n").strip()

    # บันทึกข้อความ
    # บันทึกข้อความลง LiveMessage (เพื่อแสดงผลในหน้า Unified Chat)
    msg = models.LiveMessage(
        session_id=session_id,
        sender_type=models.SenderType.staff,
        sender_name=current_user.username,
        message=clean_message
    )
    db.add(msg)

    # 🟢 เพิ่มใหม่: บันทึกข้อความลง Conversation (เพื่อแสดงผลในหน้าแชทหลักของบอท)
    conv = models.Conversation(
        session_id=session.line_user_id,
        question="[ข้อความจากเจ้าหน้าที่]", # ระบุหัวข้อไว้ให้รู้ว่าไม่ใช่คำถามทั่วไป
        answer=clean_message,
        is_answered_by_bot=False,
        is_resolved=True,
        source_channel="web",
        bot_id=session.bot_id
    )
    db.add(conv)
    
    # Commit ทีเดียวพร้อมกันทั้ง 2 ตาราง
    db.commit()

    # ส่งข้อความผ่าน Line
    bot = session.bot
    if bot.line_channel_token:
        _push_line_message(
            bot.line_channel_token,
            session.line_user_id,
            f"[เจ้าหน้าที่] {clean_message}"
        )

    return {"message": "ส่งข้อความสำเร็จ"}


# =====================
# จบการสนทนา → กลับเป็น Bot
# =====================
@router.post("/sessions/{session_id}/end")
def end_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    session = db.query(models.LiveSession).filter(
        models.LiveSession.id == session_id,
        models.LiveSession.is_active == True
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="ไม่พบ session")

    from datetime import datetime
    session.mode = models.SessionMode.bot
    session.is_active = False
    session.ended_at = datetime.utcnow()
    db.commit()

    bot = session.bot
    if bot.line_channel_token:
        _push_line_message(
            bot.line_channel_token,
            session.line_user_id,
            "ขอบคุณที่ใช้บริการครับ/ค่ะ 😊 บอทพร้อมให้บริการแล้ว หากมีคำถามเพิ่มเติมสามารถถามได้เลย"
        )

    notif = models.Notification(
        user_id=current_user.id,
        title="จบการสนทนาแล้ว",
        message=f"การสนทนากับลูกค้า {session.line_display_name or session.line_user_id} เสร็จสิ้น Bot กลับมาทำงานแล้ว",
        type="success"
    )
    db.add(notif)
    db.commit()

    return {"message": "จบการสนทนาเรียบร้อย Bot กลับมาทำงานแล้ว"}