from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from rag.rag_pipeline import ask_rag
from sqlalchemy import func
from sqlalchemy.types import Integer

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/{bot_id}", response_model=schemas.ChatResponse)
def chat(
    bot_id: str,
    body: schemas.ChatRequest,
    db: Session = Depends(get_db)
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    if bot.status != models.BotStatus.active:
        raise HTTPException(status_code=400, detail="Bot ยังไม่พร้อมใช้งาน")

    # กรอง question สั้นเกินไป
    if len(body.question.strip()) < 2:
        return {
            "answer": "กรุณาพิมพ์คำถามให้ครบถ้วน",
            "is_answered_by_bot": True,
            "conversation_id": 0
        }

    # ---- เช็คว่า session นี้อยู่ในโหมด human/waiting อยู่แล้วไหม ----
    active_session = db.query(models.LiveSession).filter(
        models.LiveSession.line_user_id == (body.session_id or "web_user"),
        models.LiveSession.bot_id == bot.id,
        models.LiveSession.is_active == True
    ).first()

    if active_session and active_session.mode in [
        models.SessionMode.waiting, models.SessionMode.human
    ]:
        # บันทึกข้อความลูกค้าลง LiveMessage
        db.add(models.LiveMessage(
            message=body.question,
            sender_type=models.SenderType.customer,
            sender_name=active_session.line_display_name or "Web User",
            session_id=active_session.id
        ))
        db.commit()
        return {
            "answer": "เจ้าหน้าที่กำลังดูแลอยู่นะครับ/ค่ะ กรุณารอสักครู่ 🙏",
            "is_answered_by_bot": False,
            "conversation_id": 0
        }

    # ---- เช็คคำขอติดต่อเจ้าหน้าที่ ----
    handoff_keywords = [
        "ขอคุยกับเจ้าหน้าที่", "ติดต่อเจ้าหน้าที่",
        "ติดต่อแอดมิน", "คุยกับคน", "contact_staff"
    ]
    if any(kw in body.question.strip().lower() for kw in handoff_keywords):
        # สร้าง LiveSession ใหม่
        new_session = models.LiveSession(
            line_user_id=body.session_id or "web_user",
            line_display_name=f"Web User ({(body.session_id or 'web')[:4]})",
            mode=models.SessionMode.waiting,
            is_active=True,
            bot_id=bot.id
        )
        db.add(new_session)
        db.flush()  # เพื่อให้ได้ id ก่อน commit

        # บันทึกข้อความแรกของลูกค้า
        db.add(models.LiveMessage(
            message=body.question,
            sender_type=models.SenderType.customer,
            sender_name=new_session.line_display_name,
            session_id=new_session.id
        ))

        # แจ้งเตือนเจ้าหน้าที่
        db.add(models.Notification(
            title="มีลูกค้ารอคิวใหม่",
            message=f"ต้องการติดต่อเจ้าหน้าที่จากบอท: {bot.name}",
            type="warning",
            user_id=bot.owner_id
        ))
        db.commit()

        return {
            "answer": "รับทราบครับ/ค่ะ 🙏 กรุณารอสักครู่ เจ้าหน้าที่กำลังเข้ามาช่วยเหลือ",
            "is_answered_by_bot": True,
            "conversation_id": 0
        }

    # ---- RAG ปกติ ----
    answer = ask_rag(body.question, bot_id)
    is_bot_answered = answer != "ไม่พบข้อมูล"

    # ถ้า Bot ตอบไม่ได้ → สร้าง session รอเจ้าหน้าที่อัตโนมัติ
    if not is_bot_answered:
        existing = db.query(models.LiveSession).filter(
            models.LiveSession.line_user_id == (body.session_id or "web_user"),
            models.LiveSession.bot_id == bot.id,
            models.LiveSession.is_active == True
        ).first()

        if not existing:
            new_session = models.LiveSession(
                line_user_id=body.session_id or "web_user",
                line_display_name=f"Web User ({(body.session_id or 'web')[:4]})",
                mode=models.SessionMode.waiting,
                is_active=True,
                bot_id=bot.id
            )
            db.add(new_session)
            db.flush()

            db.add(models.LiveMessage(
                message=body.question,
                sender_type=models.SenderType.customer,
                sender_name=new_session.line_display_name,
                session_id=new_session.id
            ))

            db.add(models.Notification(
                title="มีลูกค้ารอคิวใหม่",
                message=f"ต้องการติดต่อเจ้าหน้าที่จากบอท: {bot.name}",
                type="warning",
                user_id=bot.owner_id
            ))

    # บันทึก conversation
    conversation = models.Conversation(
        session_id=body.session_id,
        question=body.question,
        answer=answer,
        is_answered_by_bot=is_bot_answered,
        is_resolved=is_bot_answered,
        source_channel=body.source_channel or "web",
        bot_id=bot.id
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return {
        "answer": answer,
        "is_answered_by_bot": is_bot_answered,
        "conversation_id": conversation.id
    }


@router.get("/{bot_id}/history", response_model=list[schemas.ConversationOut])
def get_history(
    bot_id: str,
    page: int = 1,
    limit: int = 20,
    source_channel: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    query = db.query(models.Conversation).filter(
        models.Conversation.bot_id == bot.id
    )
    if source_channel:
        query = query.filter(
            models.Conversation.source_channel == source_channel
        )

    conversations = query.order_by(
        models.Conversation.created_at.desc()
    ).offset((page - 1) * limit).limit(limit).all()

    return conversations


@router.get("/{bot_id}/unanswered", response_model=list[schemas.ConversationOut])
def get_unanswered(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    return db.query(models.Conversation).filter(
        models.Conversation.bot_id == bot.id,
        models.Conversation.is_answered_by_bot == False,
        models.Conversation.is_resolved == False
    ).order_by(models.Conversation.created_at.desc()).all()


@router.patch("/conversations/{conv_id}/resolve")
def resolve_conversation(
    conv_id: int,
    answer: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="ไม่พบ Conversation")

    conv.answer = answer
    conv.is_resolved = True
    conv.is_answered_by_bot = False
    db.commit()
    return {"message": "ตอบกลับเรียบร้อย"}


@router.get("/{bot_id}/session/{session_id}/updates")
def get_session_updates(
    bot_id: str,
    session_id: str,
    db: Session = Depends(get_db)
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        return []

    active_session = db.query(models.LiveSession).filter(
        models.LiveSession.line_user_id == session_id,
        models.LiveSession.bot_id == bot.id,
        models.LiveSession.is_active == True
    ).first()

    if not active_session:
        return []

    staff_msgs = db.query(models.LiveMessage).filter(
        models.LiveMessage.session_id == active_session.id,
        models.LiveMessage.sender_type == models.SenderType.staff
    ).order_by(models.LiveMessage.created_at.asc()).all()

    return [
        {
            "id": str(m.id),
            "message": m.message,
            "created_at": m.created_at.isoformat()
        }
        for m in staff_msgs
    ]
@router.get("/sessions/all")
def get_all_sessions(
    page: int = 1,
    limit: int = 20,
    bot_id_filter: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    """ดึงประวัติแบบ session — 1 session = 1 แถว"""

    # หา bot ของ user นี้
    if current_user.role == models.UserRole.admin:
        bots = db.query(models.Bot).all()
    else:
        bots = db.query(models.Bot).filter(
            models.Bot.owner_id == current_user.id
        ).all()

    bot_map = {b.id: b for b in bots}
    bot_ids = list(bot_map.keys())

    if not bot_ids:
        return []

    # filter by bot
    if bot_id_filter:
        bot_obj = db.query(models.Bot).filter(
            models.Bot.bot_id == bot_id_filter
        ).first()
        if bot_obj:
            bot_ids = [bot_obj.id]

    # ดึง unique session_ids
    session_rows = db.query(
        models.Conversation.session_id,
        models.Conversation.bot_id,
        func.min(models.Conversation.created_at).label("started_at"),
        func.max(models.Conversation.created_at).label("last_at"),
        func.count(models.Conversation.id).label("msg_count"),
        func.sum(
            models.Conversation.is_answered_by_bot.cast(Integer)
        ).label("answered_count")
    ).filter(
        models.Conversation.bot_id.in_(bot_ids),
        models.Conversation.session_id.isnot(None)
    ).group_by(
        models.Conversation.session_id,
        models.Conversation.bot_id
    ).order_by(
        func.max(models.Conversation.created_at).desc()
    ).offset((page - 1) * limit).limit(limit).all()

    results = []
    for row in session_rows:
        bot = bot_map.get(row.bot_id)
        # ดึงคำถามแรกของ session นี้เป็น "ชื่อแชท"
        first_conv = db.query(models.Conversation).filter(
            models.Conversation.session_id == row.session_id,
            models.Conversation.bot_id == row.bot_id
        ).order_by(models.Conversation.created_at.asc()).first()

        # ดึงทุก conversation ใน session นี้
        convs = db.query(models.Conversation).filter(
            models.Conversation.session_id == row.session_id,
            models.Conversation.bot_id == row.bot_id
        ).order_by(models.Conversation.created_at.asc()).all()

        results.append({
            "session_id": row.session_id,
            "bot_id": bot.bot_id if bot else None,
            "bot_name": bot.name if bot else "ไม่ทราบ",
            "title": first_conv.question[:50] if first_conv else "ไม่มีข้อความ",
            "source_channel": first_conv.source_channel if first_conv else "web",
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "last_at": row.last_at.isoformat() if row.last_at else None,
            "msg_count": row.msg_count,
            "answered_count": int(row.answered_count or 0),
            "messages": [
                {
                    "id": c.id,
                    "question": c.question,
                    "answer": c.answer,
                    "is_answered_by_bot": c.is_answered_by_bot,
                    "created_at": c.created_at.isoformat()
                }
                for c in convs
            ]
        })

    return results