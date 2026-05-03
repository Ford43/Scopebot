from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from api.database import get_db
from api import models, auth
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    # กรอง bot ของ user นี้
    if current_user.role == models.UserRole.admin:
        bots = db.query(models.Bot).all()
        bot_ids = [b.id for b in bots]
    else:
        bots = db.query(models.Bot).filter(
            models.Bot.owner_id == current_user.id
        ).all()
        bot_ids = [b.id for b in bots]

    total_bots = len(bots)
    active_bots = sum(1 for b in bots if b.status == models.BotStatus.active)

    # จำนวน conversation ทั้งหมด
    total_conversations = db.query(models.Conversation).filter(
        models.Conversation.bot_id.in_(bot_ids)
    ).count() if bot_ids else 0

    # คำถามที่ Bot ตอบไม่ได้ รอ human
    unanswered = db.query(models.Conversation).filter(
        models.Conversation.bot_id.in_(bot_ids),
        models.Conversation.is_answered_by_bot == False,
        models.Conversation.is_resolved == False
    ).count() if bot_ids else 0

    # แชทวันนี้
    today = datetime.utcnow().date()
    today_conversations = db.query(models.Conversation).filter(
        models.Conversation.bot_id.in_(bot_ids),
        func.date(models.Conversation.created_at) == today
    ).count() if bot_ids else 0

    # แชท 7 วันย้อนหลัง (สำหรับกราฟ)
    weekly_stats = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        count = db.query(models.Conversation).filter(
            models.Conversation.bot_id.in_(bot_ids),
            func.date(models.Conversation.created_at) == day
        ).count() if bot_ids else 0
        weekly_stats.append({
            "date": day.strftime("%d/%m"),
            "count": count
        })

    # อัตราการตอบสำเร็จ
    bot_answered = db.query(models.Conversation).filter(
        models.Conversation.bot_id.in_(bot_ids),
        models.Conversation.is_answered_by_bot == True
    ).count() if bot_ids else 0

    success_rate = round(
        (bot_answered / total_conversations * 100) if total_conversations > 0 else 0, 1
    )

    # เอกสารทั้งหมด
    total_documents = db.query(models.Document).filter(
        models.Document.owner_id == current_user.id
    ).count()

    # unread notifications
    unread_notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()

    return {
        "total_bots": total_bots,
        "active_bots": active_bots,
        "total_conversations": total_conversations,
        "today_conversations": today_conversations,
        "unanswered": unanswered,
        "success_rate": success_rate,
        "total_documents": total_documents,
        "unread_notifications": unread_notifications,
        "weekly_stats": weekly_stats
    }


@router.get("/bot-stats/{bot_id}")
def get_bot_stats(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = db.query(models.Bot).filter(
        models.Bot.bot_id == bot_id
    ).first()
    if not bot:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    total = db.query(models.Conversation).filter(
        models.Conversation.bot_id == bot.id
    ).count()

    answered = db.query(models.Conversation).filter(
        models.Conversation.bot_id == bot.id,
        models.Conversation.is_answered_by_bot == True
    ).count()

    unanswered = db.query(models.Conversation).filter(
        models.Conversation.bot_id == bot.id,
        models.Conversation.is_answered_by_bot == False,
        models.Conversation.is_resolved == False
    ).count()

    line_count = db.query(models.Conversation).filter(
        models.Conversation.bot_id == bot.id,
        models.Conversation.source_channel == "line"
    ).count()

    web_count = db.query(models.Conversation).filter(
        models.Conversation.bot_id == bot.id,
        models.Conversation.source_channel == "web"
    ).count()

    return {
        "bot_id": bot_id,
        "bot_name": bot.name,
        "status": bot.status,
        "total_conversations": total,
        "answered_by_bot": answered,
        "unanswered": unanswered,
        "success_rate": round((answered / total * 100) if total > 0 else 0, 1),
        "by_channel": {
            "line": line_count,
            "web": web_count
        },
        "document_count": len(bot.documents)
    }