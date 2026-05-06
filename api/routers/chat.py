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
    # ดึง bot [cite: 370]
    bot = db.query(models.Bot).filter(models.Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="ไม่พบ Bot")

    if bot.status != models.BotStatus.active:
        raise HTTPException(status_code=400, detail="Bot ยังไม่พร้อมใช้งาน") 

    # 1. เช็คก่อนว่า User คนนี้กำลังอยู่ในโหมดคุยกับเจ้าหน้าที่ (waiting/human) หรือไม่
    # ประยุกต์ใช้ session_id จากเว็บแทน line_user_id ก่อนเพื่อทดสอบ
    active_session = db.query(models.LiveSession).filter(
        models.LiveSession.line_user_id == body.session_id,
        models.LiveSession.is_active == True,
        models.LiveSession.bot_id == bot.id
    ).first()

    if active_session and active_session.mode in ["waiting", "human"]:
        # ถ้าอยู่ในโหมดเจ้าหน้าที่ ให้บันทึกแชทลง LiveMessage เลย ไม่ต้องผ่าน RAG
        live_msg = models.LiveMessage(
            message=body.question,
            sender_type="customer",
            sender_name=active_session.line_display_name,
            session_id=active_session.id
        )
        db.add(live_msg)
        db.commit()
        return {
            "answer": "ระบบกำลังอยู่ในโหมดโอนสาย เจ้าหน้าที่จะรีบมาตอบกลับโดยเร็วที่สุดค่ะ",
            "is_answered_by_bot": False,
            "conversation_id": 0
        }

    # 2. ถ้าไม่ได้คุยกับเจ้าหน้าที่ ให้ถามผ่าน RAG pipeline ปกติ [cite: 371]
    answer = ask_rag(body.question, bot_id, user_system_prompt=bot.system_prompt) 
    
    is_bot_answered = True
    display_answer = answer

    # 3. 🟢 ดักจับ Signal โอนสายจาก RAG
    if answer == "REQUIRE_HUMAN_HANDOFF" or answer == "ไม่พบข้อมูล":
        is_bot_answered = False
        display_answer = "ไม่พบข้อมูลในระบบ กำลังโอนสายไปยังเจ้าหน้าที่ กรุณารอสักครู่ค่ะ..."

        # สร้าง Live Session เอาลูกค้าเข้าคิวรอใน UnifiedChat
        new_session = models.LiveSession(
            line_user_id=body.session_id, # ใช้ session_id แทนก่อนตอนทดสอบบนเว็บ
            line_display_name=f"Web User ({body.session_id[:4]})",
            mode="waiting",
            is_active=True,
            bot_id=bot.id
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        # บันทึกคำถามที่บอทตอบไม่ได้ ลงในห้องแชทของเจ้าหน้าที่
        first_msg = models.LiveMessage(
            message=body.question,
            sender_type="customer",
            sender_name=new_session.line_display_name,
            session_id=new_session.id
        )
        db.add(first_msg)

        # แจ้งเตือนกระดิ่งมุมขวาบนให้แอดมินรู้
        notif = models.Notification(
            title="มีลูกค้ารอคิวใหม่",
            message=f"ต้องการติดต่อเจ้าหน้าที่จากบอท: {bot.name}",
            type="warning",
            user_id=bot.owner_id
        )
        db.add(notif)

    # 4. บันทึก conversation ประวัติแชทปกติ 
    conversation = models.Conversation(
        session_id=body.session_id, 
        question=body.question, 
        answer=display_answer,
        is_answered_by_bot=is_bot_answered, 
        is_resolved=is_bot_answered, 
        source_channel=body.source_channel,
        bot_id=bot.id 
    )
    db.add(conversation) 
    db.commit() 
    db.refresh(conversation) 

    return {
        "answer": display_answer,
        "is_answered_by_bot": is_bot_answered, 
        "conversation_id": conversation.id 
    }