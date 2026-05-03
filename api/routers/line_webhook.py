import hashlib
import hmac
import base64
import json
from fastapi import APIRouter, Request, HTTPException
from linebot.v3.messaging import (
    Configuration, ApiClient, MessagingApi,
    ReplyMessageRequest, TextMessage,
    FlexMessage, FlexContainer
)
from api.database import SessionLocal
from api import models
from rag.rag_pipeline import ask_rag

router = APIRouter(prefix="/api/line", tags=["Line Webhook"])

# ข้อความ Flex ปุ่มติดต่อเจ้าหน้าที่
CONTACT_FLEX = {
    "type": "bubble",
    "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
            {
                "type": "text",
                "text": "ขออภัย ไม่พบข้อมูลที่ต้องการ",
                "weight": "bold",
                "size": "md",
                "wrap": True
            },
            {
                "type": "text",
                "text": "ต้องการติดต่อเจ้าหน้าที่หรือไม่?",
                "size": "sm",
                "color": "#888888",
                "margin": "md",
                "wrap": True
            }
        ]
    },
    "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
            {
                "type": "button",
                "style": "primary",
                "action": {
                    "type": "message",
                    "label": "ติดต่อเจ้าหน้าที่",
                    "text": "ติดต่อเจ้าหน้าที่"
                }
            }
        ]
    }
}


def _handle_small_talk(text: str) -> str | None:
    """
    จัดการคำทักทาย/ขอบคุณ/คำทั่วไป
    คืน None ถ้าไม่ใช่ small talk → ส่งต่อให้ RAG
    """
    t = text.strip().lower()

    # ทักทาย
    greetings = ["สวัสดี", "หวัดดี", "ดีครับ", "ดีค่ะ", "hello", "hi", "hey",
                 "สวัสดีครับ", "สวัสดีค่ะ", "ดีจ้า", "หวัดดีครับ", "หวัดดีค่ะ"]
    if any(t.startswith(g) or t == g for g in greetings):
        return "สวัสดีครับ/ค่ะ 😊 มีอะไรให้ช่วยเหลือไหมครับ?"

    # ขอบคุณ
    thanks = ["ขอบคุณ", "ขอบใจ", "thanks", "thank you", "thx",
              "ขอบคุณครับ", "ขอบคุณค่ะ", "ขอบคุณมาก", "ขอบคุณนะ",
              "ขอบคุณนะครับ", "ขอบคุณนะค่ะ", "โอเคขอบคุณ", "ok ขอบคุณ"]
    if any(t2 in t for t2 in thanks):
        return "ยินดีให้บริการเสมอครับ/ค่ะ 😊 หากมีคำถามเพิ่มเติมสามารถถามได้เลย"

    # ลาก่อน
    bye = ["ลาก่อน", "บาย", "bye", "goodbye", "แล้วเจอกัน",
           "โอเคครับ", "โอเคค่ะ", "ได้เลย", "โอเค", "ok", "oke", "okay"]
    if any(t == b or t.startswith(b) for b in bye):
        return "ลาก่อนครับ/ค่ะ 👋 หากต้องการความช่วยเหลือกลับมาได้เสมอนะครับ"

    # ถามสบายดีไหม
    how_are_you = ["สบายดีไหม", "เป็นยังไงบ้าง", "how are you"]
    if any(h in t for h in how_are_you):
        return "สบายดีครับ/ค่ะ 😊 ขอบคุณที่ถาม มีอะไรให้ช่วยเหลือไหมครับ?"

    return None  # ไม่ใช่ small talk → ส่งต่อให้ RAG


def _verify_signature(secret: str, body: str, signature: str) -> bool:
    hash_value = hmac.new(
        secret.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256
    ).digest()
    expected = base64.b64encode(hash_value).decode("utf-8")
    return hmac.compare_digest(expected, signature)


def _get_display_name(token: str, line_user_id: str) -> str:
    """ดึงชื่อลูกค้าจาก Line"""
    try:
        configuration = Configuration(access_token=token)
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            profile = line_bot_api.get_profile(line_user_id)
            return profile.display_name
    except:
        return line_user_id


@router.post("/webhook/{bot_id}")
async def line_webhook(bot_id: str, request: Request):
    db = SessionLocal()
    try:
        bot = db.query(models.Bot).filter(
            models.Bot.bot_id == bot_id
        ).first()

        if not bot or not bot.is_line_connected:
            raise HTTPException(status_code=404, detail="ไม่พบ Bot หรือยังไม่ได้เชื่อม Line")

        if not bot.line_channel_secret or not bot.line_channel_token:
            raise HTTPException(status_code=400, detail="ยังไม่ได้ตั้งค่า Line credentials")

        body = await request.body()
        body_str = body.decode("utf-8")
        signature = request.headers.get("X-Line-Signature", "")

        if not _verify_signature(bot.line_channel_secret, body_str, signature):
            raise HTTPException(status_code=400, detail="Invalid signature")

        payload = json.loads(body_str)
        events = payload.get("events", [])

        configuration = Configuration(access_token=bot.line_channel_token)

        for event in events:
            if event.get("type") != "message":
                continue
            if event.get("message", {}).get("type") != "text":
                continue

            reply_token = event.get("replyToken")
            user_message = event.get("message", {}).get("text", "")
            line_user_id = event.get("source", {}).get("userId", "")

            if not user_message or not reply_token:
                continue

            # ดึงหรือสร้าง live session
            session = db.query(models.LiveSession).filter(
                models.LiveSession.line_user_id == line_user_id,
                models.LiveSession.bot_id == bot.id,
                models.LiveSession.is_active == True
            ).first()

            if not session:
                display_name = _get_display_name(bot.line_channel_token, line_user_id)
                session = models.LiveSession(
                    line_user_id=line_user_id,
                    line_display_name=display_name,
                    bot_id=bot.id,
                    mode=models.SessionMode.bot
                )
                db.add(session)
                db.commit()
                db.refresh(session)

            # บันทึกข้อความลูกค้า
            db.add(models.LiveMessage(
                session_id=session.id,
                sender_type=models.SenderType.customer,
                sender_name=session.line_display_name,
                message=user_message
            ))
            db.commit()

            with ApiClient(configuration) as api_client:
                line_bot_api = MessagingApi(api_client)

                # ---- mode human → ไม่ตอบ แค่บันทึก ----
                if session.mode == models.SessionMode.human:
                    continue

                # ---- mode waiting → แจ้งว่ารอเจ้าหน้าที่ ----
                if session.mode == models.SessionMode.waiting:
                    line_bot_api.reply_message(
                        ReplyMessageRequest(
                            reply_token=reply_token,
                            messages=[TextMessage(
                                text="กรุณารอสักครู่นะครับ/ค่ะ เจ้าหน้าที่กำลังเข้ามาช่วยเหลือ 🙏"
                            )]
                        )
                    )
                    continue

                # ---- ลูกค้าขอติดต่อเจ้าหน้าที่ ----
                if user_message == "ติดต่อเจ้าหน้าที่" or any(
                    word in user_message for word in ["คุยกับคน", "พูดกับคน", "ขอคุยกับเจ้าหน้าที่"]
                ):
                    session.mode = models.SessionMode.waiting
                    db.add(models.Notification(
                        user_id=bot.owner_id,
                        title="🔔 ลูกค้าต้องการติดต่อเจ้าหน้าที่",
                        message=f"{session.line_display_name or line_user_id} ต้องการความช่วยเหลือใน Bot '{bot.name}'",
                        type="warning"
                    ))
                    db.commit()
                    line_bot_api.reply_message(
                        ReplyMessageRequest(
                            reply_token=reply_token,
                            messages=[TextMessage(
                                text="รับทราบครับ/ค่ะ 🙏 กรุณารอสักครู่ เจ้าหน้าที่กำลังเข้ามาช่วยเหลือ"
                            )]
                        )
                    )
                    continue

                # ---- Small Talk Handler ----
                small_talk_response = _handle_small_talk(user_message)
                if small_talk_response:
                    line_bot_api.reply_message(
                        ReplyMessageRequest(
                            reply_token=reply_token,
                            messages=[TextMessage(text=small_talk_response)]
                        )
                    )
                    db.add(models.Conversation(
                        session_id=line_user_id,
                        question=user_message,
                        answer=small_talk_response,
                        is_answered_by_bot=True,
                        is_resolved=True,
                        source_channel="line",
                        bot_id=bot.id
                    ))
                    db.add(models.LiveMessage(
                        session_id=session.id,
                        sender_type=models.SenderType.bot,
                        sender_name="Bot",
                        message=small_talk_response
                    ))
                    db.commit()
                    continue

                # ---- RAG ----
                answer = ask_rag(user_message, bot_id)
                is_bot_answered = answer != "ไม่พบข้อมูล"

                db.add(models.Conversation(
                    session_id=line_user_id,
                    question=user_message,
                    answer=answer,
                    is_answered_by_bot=is_bot_answered,
                    is_resolved=is_bot_answered,
                    source_channel="line",
                    bot_id=bot.id
                ))
                db.add(models.LiveMessage(
                    session_id=session.id,
                    sender_type=models.SenderType.bot,
                    sender_name="Bot",
                    message=answer if is_bot_answered else "ไม่พบข้อมูล"
                ))
                db.commit()

                if is_bot_answered:
                    # Bot ตอบได้ → ส่งคำตอบปกติ
                    line_bot_api.reply_message(
                        ReplyMessageRequest(
                            reply_token=reply_token,
                            messages=[TextMessage(text=answer)]
                        )
                    )
                else:
                    # Bot ตอบไม่ได้ → ส่ง Flex Message ปุ่มติดต่อเจ้าหน้าที่
                    line_bot_api.reply_message(
                        ReplyMessageRequest(
                            reply_token=reply_token,
                            messages=[
                                FlexMessage(
                                    alt_text="ไม่พบข้อมูล — ติดต่อเจ้าหน้าที่",
                                    contents=FlexContainer.from_dict(CONTACT_FLEX)
                                )
                            ]
                        )
                    )

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Line webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()