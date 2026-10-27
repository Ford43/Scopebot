from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from rag.rag_pipeline import ask_rag, RagUnavailableError, RAG_ERROR_MESSAGE
from api.chat_history import recent_bot_history, session_rows, session_transcript, iso_utc

router = APIRouter(prefix="/api/chat", tags=["Chat"])

HANDOFF_KEYWORDS = (
    "ขอคุยกับเจ้าหน้าที่",
    "ติดต่อเจ้าหน้าที่",
    "ติดต่อแอดมิน",
    "คุยกับคน",
    "contact_staff",
)


def _mode_str(session: models.LiveSession | None) -> str:
    if not session:
        return "bot"
    mode = session.mode
    return mode.value if hasattr(mode, "value") else str(mode)


def _chat_payload(
    *,
    answer: str,
    is_answered_by_bot: bool,
    conversation_id: int = 0,
    sources: list | None = None,
    session_mode: str = "bot",
    offer_handoff: bool = False,
    response_status: str = "answered",
) -> dict:
    return {
        "answer": answer,
        "is_answered_by_bot": is_answered_by_bot,
        "conversation_id": conversation_id,
        "sources": sources or [],
        "session_mode": session_mode,
        "offer_handoff": offer_handoff,
        "response_status": response_status,
    }


@router.post("/{bot_id}", response_model=schemas.ChatResponse)
def chat(
    bot_id: str,
    body: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator),
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    auth.assert_bot_access(current_user, bot)

    if not bot.has_usable_knowledge:
        raise HTTPException(status_code=400, detail="Bot ยังไม่พร้อมใช้งาน")

    # กรอง question สั้นเกินไป
    if len(body.question.strip()) < 2:
        return _chat_payload(
            answer="กรุณาพิมพ์คำถามให้ครบถ้วน",
            is_answered_by_bot=True,
        )

    session_key = body.session_id or "web_user"

    # ---- เช็คว่า session นี้อยู่ในโหมด human/waiting อยู่แล้วไหม ----
    active_session = db.query(models.LiveSession).filter(
        models.LiveSession.line_user_id == session_key,
        models.LiveSession.bot_id == bot.id,
        models.LiveSession.is_active == True
    ).first()

    if active_session and active_session.mode in [
        models.SessionMode.waiting, models.SessionMode.human
    ]:
        db.add(models.LiveMessage(
            message=body.question,
            sender_type=models.SenderType.customer,
            sender_name=active_session.line_display_name or "Web User",
            session_id=active_session.id
        ))
        db.commit()
        waiting = active_session.mode == models.SessionMode.waiting
        return _chat_payload(
            answer=(
                "ข้อความถูกส่งถึงเจ้าหน้าที่แล้ว กรุณารอสักครู่ 🙏"
                if waiting
                else "ส่งถึงเจ้าหน้าที่แล้วครับ/ค่ะ"
            ),
            is_answered_by_bot=False,
            session_mode=_mode_str(active_session),
        )

    # ---- เช็คคำขอติดต่อเจ้าหน้าที่ ----
    if any(kw in body.question.strip().lower() for kw in HANDOFF_KEYWORDS):
        new_session = models.LiveSession(
            line_user_id=session_key,
            line_display_name=f"Web User ({session_key[:8]})",
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
        db.commit()

        return _chat_payload(
            answer="รับทราบครับ/ค่ะ 🙏 กรุณารอสักครู่ เจ้าหน้าที่กำลังเข้ามาช่วยเหลือ",
            is_answered_by_bot=False,
            session_mode="waiting",
        )

    # ---- RAG ปกติ ----
    source = (body.source_channel or "web").lower()
    rag_failed = False
    try:
        answer, sources = ask_rag(
            body.question, bot_id, user_system_prompt=bot.system_prompt,
            history=recent_bot_history(db, bot.id, body.session_id, source),
        )
    except RagUnavailableError:
        answer, sources, rag_failed = RAG_ERROR_MESSAGE, [], True

    # Web: ไม่ auto-handoff — แสดงปุ่มติดต่อเจ้าหน้าที่ให้ลูกค้ากดเอง
    # LINE / ช่องทางอื่น: สร้าง LiveSession เมื่อบอทตอบไม่ได้
    create_live = False
    offer_handoff = False
    if rag_failed:
        is_bot_answered = False
        offer_handoff = source == "web"
    elif answer == "REQUIRE_HUMAN_HANDOFF":
        if source == "web":
            answer = (
                "ไม่พบข้อมูลที่เกี่ยวข้องในฐานความรู้ "
                "สามารถกดปุ่มติดต่อเจ้าหน้าที่ด้านล่างได้เลย"
            )
            is_bot_answered = False
            offer_handoff = True
            sources = []
        else:
            answer = "ไม่พบข้อมูล กรุณารอสักครู่ กำลังส่งต่อให้เจ้าหน้าที่"
            is_bot_answered = False
            create_live = True
    else:
        is_bot_answered = "ไม่พบข้อมูล" not in answer
        create_live = source != "web" and not is_bot_answered
        offer_handoff = source == "web" and not is_bot_answered

    if create_live:
        existing = db.query(models.LiveSession).filter(
            models.LiveSession.line_user_id == session_key,
            models.LiveSession.bot_id == bot.id,
            models.LiveSession.is_active == True
        ).first()

        if not existing:
            new_session = models.LiveSession(
                line_user_id=session_key,
                line_display_name=f"Web User ({session_key[:4]})",
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
        source_channel=source,
        bot_id=bot.id
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return _chat_payload(
        answer=answer,
        is_answered_by_bot=is_bot_answered,
        conversation_id=conversation.id,
        sources=sources if is_bot_answered else [],
        session_mode="waiting" if create_live else "bot",
        offer_handoff=offer_handoff,
        response_status="error" if rag_failed else ("answered" if is_bot_answered else "unanswered"),
    )


@router.get("/{bot_id}/history", response_model=list[schemas.ConversationOut])
def get_history(
    bot_id: str,
    page: int = 1,
    limit: int = 20,
    source_channel: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    auth.assert_bot_access(current_user, bot)

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
    current_user: models.User = Depends(auth.require_shop_operator)
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    auth.assert_bot_access(current_user, bot)

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
    current_user: models.User = Depends(auth.require_shop_operator)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="ไม่พบ Conversation")

    bot = db.query(models.Bot).filter(models.Bot.id == conv.bot_id).first()
    auth.assert_bot_access(current_user, bot)

    conv.answer = answer
    conv.is_resolved = True
    conv.is_answered_by_bot = False
    db.commit()
    return {"message": "ตอบกลับเรียบร้อย"}


@router.get("/{bot_id}/session/{session_id}/updates")
def get_session_updates(
    bot_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator),
):
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        return []
    try:
        auth.assert_bot_access(current_user, bot)
    except HTTPException:
        return []

    session = (
        db.query(models.LiveSession)
        .filter(
            models.LiveSession.line_user_id == session_id,
            models.LiveSession.bot_id == bot.id,
        )
        .order_by(models.LiveSession.started_at.desc(), models.LiveSession.id.desc())
        .first()
    )

    if not session:
        return {"mode": "bot", "is_active": False, "messages": []}

    staff_msgs = (
        db.query(models.LiveMessage)
        .join(models.LiveSession, models.LiveMessage.session_id == models.LiveSession.id)
        .filter(models.LiveSession.bot_id == bot.id,
                models.LiveSession.line_user_id == session_id,
                models.LiveMessage.sender_type == models.SenderType.staff)
        .order_by(models.LiveMessage.created_at.asc(), models.LiveMessage.id.asc()).all()
    )

    mode = _mode_str(session)
    if not session.is_active:
        mode = "bot"

    return {
        "mode": mode,
        "is_active": bool(session.is_active),
        "messages": [
            {
                "id": str(m.id),
                "message": m.message,
                "sender_name": m.sender_name or "เจ้าหน้าที่",
                "created_at": iso_utc(m.created_at),
            }
            for m in staff_msgs
        ],
    }
@router.get("/sessions/all")
def get_all_sessions(
    page: int = 1,
    limit: int = 20,
    bot_id_filter: str = None,
    scope: str = "all",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_shop_operator)
):
    """ดึงประวัติแบบ session — 1 session = 1 แถว"""

    bots = auth.visible_bots_query(db, current_user, scope).all()
    bot_map = {b.id: b for b in bots}
    bot_ids = list(bot_map.keys())

    if not bot_ids:
        return []

    # filter by bot — ต้องอยู่ในชุดที่ผู้ใช้มีสิทธิ์เห็น
    if bot_id_filter:
        bot_obj = next((b for b in bots if b.bot_id == bot_id_filter), None)
        if not bot_obj:
            return []
        bot_ids = [bot_obj.id]

    rows = session_rows(db, bot_ids, page, max(1, min(limit, 100)))

    results = []
    for row in rows:
        bot = bot_map.get(row.bot_id)
        convs, timeline, source = session_transcript(db, row.bot_id, row.session_id)
        title = next((m["text"][:50] for m in timeline if m["sender"] == "user"), "ไม่มีข้อความ")

        results.append({
            "session_id": row.session_id,
            "bot_id": bot.bot_id if bot else None,
            "bot_name": bot.name if bot else "ไม่ทราบ",
            "title": title,
            "source_channel": source,
            "started_at": iso_utc(row.started_at) if row.started_at else None,
            "last_at": iso_utc(row.last_at) if row.last_at else None,
            "msg_count": sum(m["sender"] == "user" for m in timeline),
            "answered_count": sum(bool(c.is_answered_by_bot) for c in convs),
            "timeline": timeline,
            "messages": [
                {
                    "id": c.id,
                    "question": c.question,
                    "answer": c.answer,
                    "is_answered_by_bot": c.is_answered_by_bot,
                    "created_at": iso_utc(c.created_at)
                }
                for c in convs
            ]
        })

    return results
