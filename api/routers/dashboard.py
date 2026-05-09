from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
<<<<<<< HEAD
from sqlalchemy import func
=======
from sqlalchemy import func, distinct
>>>>>>> master
from api.database import get_db
from api import models, auth
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_stats(
<<<<<<< HEAD
=======
    days: int = 7,  # ← user เลือกได้ผ่าน ?days=7 หรือ ?days=30
>>>>>>> master
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    # กรอง bot ของ user นี้
    if current_user.role == models.UserRole.admin:
        bots = db.query(models.Bot).all()
<<<<<<< HEAD
        bot_ids = [b.id for b in bots]
=======
>>>>>>> master
    else:
        bots = db.query(models.Bot).filter(
            models.Bot.owner_id == current_user.id
        ).all()
<<<<<<< HEAD
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
=======

    bot_ids = [b.id for b in bots]
    total_bots = len(bots)
    active_bots = sum(1 for b in bots if b.status == models.BotStatus.active)

    base_query = db.query(models.Conversation).filter(
        models.Conversation.bot_id.in_(bot_ids)
    ) if bot_ids else db.query(models.Conversation).filter(False)

    # ---- ตัวเลขรวม ----
    total_conversations = base_query.count()

    # นับ unique sessions (1 session = 1 แชท)
    total_sessions = db.query(
        func.count(distinct(models.Conversation.session_id))
    ).filter(
        models.Conversation.bot_id.in_(bot_ids)
    ).scalar() or 0 if bot_ids else 0

    today = datetime.utcnow().date()
    today_sessions = db.query(
        func.count(distinct(models.Conversation.session_id))
    ).filter(
        models.Conversation.bot_id.in_(bot_ids),
        func.date(models.Conversation.created_at) == today
    ).scalar() or 0 if bot_ids else 0

    unanswered = base_query.filter(
        models.Conversation.is_answered_by_bot == False,
        models.Conversation.is_resolved == False
    ).count()

    bot_answered = base_query.filter(
        models.Conversation.is_answered_by_bot == True
    ).count()

    success_rate = round(
        (bot_answered / total_conversations * 100)
        if total_conversations > 0 else 0, 1
    )

>>>>>>> master
    total_documents = db.query(models.Document).filter(
        models.Document.owner_id == current_user.id
    ).count()

<<<<<<< HEAD
    # unread notifications
=======
>>>>>>> master
    unread_notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()

<<<<<<< HEAD
    return {
        "total_bots": total_bots,
        "active_bots": active_bots,
        "total_conversations": total_conversations,
        "today_conversations": today_conversations,
=======
    # ---- Line vs Web ----
    line_sessions = db.query(
        func.count(distinct(models.Conversation.session_id))
    ).filter(
        models.Conversation.bot_id.in_(bot_ids),
        models.Conversation.source_channel == "line"
    ).scalar() or 0 if bot_ids else 0

    web_sessions = db.query(
        func.count(distinct(models.Conversation.session_id))
    ).filter(
        models.Conversation.bot_id.in_(bot_ids),
        models.Conversation.source_channel == "web"
    ).scalar() or 0 if bot_ids else 0

    # ---- New vs Returning users ----
    # session ที่เห็นครั้งแรกวันนี้ = new
    today_session_ids = db.query(
        distinct(models.Conversation.session_id)
    ).filter(
        models.Conversation.bot_id.in_(bot_ids),
        func.date(models.Conversation.created_at) == today
    ).all() if bot_ids else []

    today_session_ids = [s[0] for s in today_session_ids if s[0]]
    new_users = 0
    returning_users = 0

    for sid in today_session_ids:
        # เช็คว่า session นี้เคยมาก่อนวันนี้ไหม
        prev = db.query(models.Conversation).filter(
            models.Conversation.session_id == sid,
            models.Conversation.bot_id.in_(bot_ids),
            func.date(models.Conversation.created_at) < today
        ).first()
        if prev:
            returning_users += 1
        else:
            new_users += 1

    # ---- Daily stats ตาม range ที่เลือก ----
    daily_stats = []
    for i in range(days - 1, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        sessions = db.query(
            func.count(distinct(models.Conversation.session_id))
        ).filter(
            models.Conversation.bot_id.in_(bot_ids),
            func.date(models.Conversation.created_at) == day
        ).scalar() or 0 if bot_ids else 0

        line_count = db.query(
            func.count(distinct(models.Conversation.session_id))
        ).filter(
            models.Conversation.bot_id.in_(bot_ids),
            models.Conversation.source_channel == "line",
            func.date(models.Conversation.created_at) == day
        ).scalar() or 0 if bot_ids else 0

        web_count = db.query(
            func.count(distinct(models.Conversation.session_id))
        ).filter(
            models.Conversation.bot_id.in_(bot_ids),
            models.Conversation.source_channel == "web",
            func.date(models.Conversation.created_at) == day
        ).scalar() or 0 if bot_ids else 0

        daily_stats.append({
            "date": day.strftime("%d/%m"),
            "total": sessions,
            "line": line_count,
            "web": web_count,
        })

    return {
        # Overview
        "total_bots": total_bots,
        "active_bots": active_bots,
        "total_sessions": total_sessions,
        "today_sessions": today_sessions,
>>>>>>> master
        "unanswered": unanswered,
        "success_rate": success_rate,
        "total_documents": total_documents,
        "unread_notifications": unread_notifications,
<<<<<<< HEAD
        "weekly_stats": weekly_stats
=======
        # Platform
        "platform": {
            "line": line_sessions,
            "web": web_sessions,
        },
        # New vs Returning
        "users": {
            "new": new_users,
            "returning": returning_users,
        },
        # Daily chart
        "daily_stats": daily_stats,
        "days": days,
>>>>>>> master
    }


@router.get("/bot-stats/{bot_id}")
def get_bot_stats(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
<<<<<<< HEAD
    bot = db.query(models.Bot).filter(
        models.Bot.bot_id == bot_id
    ).first()
    if not bot:
        from fastapi import HTTPException
=======
    from fastapi import HTTPException
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
>>>>>>> master
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
<<<<<<< HEAD
        "by_channel": {
            "line": line_count,
            "web": web_count
        },
        "document_count": len(bot.documents)
    }
=======
        "by_channel": {"line": line_count, "web": web_count},
        "document_count": len(bot.documents)
    }
@router.get("/top-questions")
def get_top_questions(
    days: int = 7,
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    if current_user.role == models.UserRole.admin:
        bots = db.query(models.Bot).all()
    else:
        bots = db.query(models.Bot).filter(
            models.Bot.owner_id == current_user.id
        ).all()

    bot_ids = [b.id for b in bots]
    if not bot_ids:
        return []

    cutoff = datetime.utcnow() - timedelta(days=days)

    results = db.query(
        models.Conversation.question,
        func.count(models.Conversation.id).label("count")
    ).filter(
        models.Conversation.bot_id.in_(bot_ids),
        models.Conversation.created_at >= cutoff,
        ~models.Conversation.question.in_([
            "[ข้อความจากเจ้าหน้าที่]",
            "ติดต่อเจ้าหน้าที่",
            "REQUIRE_HUMAN_HANDOFF",
            "contact_staff",
            "string"
        ]),
        func.length(models.Conversation.question) > 3  
    ).group_by(
        models.Conversation.question
    ).order_by(
        func.count(models.Conversation.id).desc()
    ).limit(limit).all()

    return [{"question": r.question, "count": r.count} for r in results]
>>>>>>> master
