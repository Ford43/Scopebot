from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.database import get_db
from api import models, schemas, auth
from rag.rag_pipeline import ask_rag

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/{bot_id}", response_model=schemas.ChatResponse)
def chat(
    bot_id: str,
    body: schemas.ChatRequest,
    db: Session = Depends(get_db)
):
    # ดึง bot (ไม่ต้อง login สำหรับ endpoint นี้ — ลูกค้าใช้)
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    if bot.status != models.BotStatus.active:
        raise HTTPException(status_code=400, detail="Bot ยังไม่พร้อมใช้งาน")

    # ถามผ่าน RAG pipeline
    answer = ask_rag(body.question, bot_id, user_system_prompt=bot.system_prompt)
    is_bot_answered = answer != "ไม่พบข้อมูล"

    # บันทึก conversation
    conversation = models.Conversation(
        session_id=body.session_id,
        question=body.question,
        answer=answer,
        is_answered_by_bot=is_bot_answered,
        is_resolved=is_bot_answered,  # ถ้า bot ตอบได้ = resolved
        source_channel=body.source_channel,
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
        query = query.filter(models.Conversation.source_channel == source_channel)

    total = query.count()
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
    """คำถามที่ Bot ตอบไม่ได้ รอ human ตอบ"""
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    return db.query(models.Conversation)\
        .filter(
            models.Conversation.bot_id == bot.id,
            models.Conversation.is_answered_by_bot == False,
            models.Conversation.is_resolved == False
        ).all()


@router.patch("/conversations/{conv_id}/resolve")
def resolve_conversation(
    conv_id: int,
    answer: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_approved_user)
):
    """User ตอบแทน Bot"""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="ไม่พบ Conversation")

    conv.answer = answer
    conv.is_resolved = True
    conv.is_answered_by_bot = False
    db.commit()
    return {"message": "ตอบกลับเรียบร้อย"}