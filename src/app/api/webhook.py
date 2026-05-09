from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from linebot.v3 import WebhookParser
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import Configuration, ApiClient, MessagingApi, ReplyMessageRequest, TextMessage
from linebot.v3.webhooks import MessageEvent, TextMessageContent
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

# Import โมเดลและฟังก์ชันฐานข้อมูลของคุณ
from app.database import get_db
from app import models

router = APIRouter()

# ฟังก์ชันนี้จะทำงานอยู่เบื้องหลัง เพื่อไม่ให้ LINE รอนานเกิน 1 วินาที
async def process_bot_reply(event: MessageEvent, channel_access_token: str):
    # 1. ตั้งค่าการเชื่อมต่อสำหรับตอบกลับ LINE
    configuration = Configuration(access_token=channel_access_token)
    
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        user_message = event.message.text
        
        # TODO: อนาคตเราจะเอาคำถามนี้ไปค้นหาใน Vector DB (RAG) แล้วให้ LLM ตอบ
        # แต่ตอนนี้ให้บอทเป็นนกแก้ว (Echo) พูดตามไปก่อนเพื่อทดสอบระบบ
        reply_text = f"บอทได้รับข้อความว่า: {user_message}"
        
        # ส่งข้อความกลับไปหาผู้ใช้
        line_bot_api.reply_message(
            ReplyMessageRequest(
                reply_token=event.reply_token,
                messages=[TextMessage(text=reply_text)]
            )
        )

# Endpoint สำหรับรับ Webhook (รองรับบอทหลายตัวด้วยการรับ {bot_id} ผ่าน URL)
@router.post("/{bot_id}")
async def line_webhook(
    bot_id: UUID, 
    request: Request, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    # 1. ดึงข้อมูล Credential ของบอทตัวนี้จากฐานข้อมูล
    from sqlalchemy.future import select
    result = await db.execute(select(models.LineChannel).where(models.LineChannel.bot_id == bot_id))
    line_channel = result.scalars().first()
    
    if not line_channel:
        raise HTTPException(status_code=404, detail="Bot or Line Channel not found")

    channel_secret = line_channel.line_channel_secret
    channel_access_token = line_channel.line_channel_access_token

    # 2. ตรวจสอบลายเซ็น (Signature) ว่ามาจาก LINE จริงๆ
    signature = request.headers.get("X-Line-Signature", "")
    body = await request.body()
    body_str = body.decode("utf-8")
    
    parser = WebhookParser(channel_secret)
    
    try:
        events = parser.parse(body_str, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature. Please check your channel secret.")

    # 3. วนลูปอ่านข้อความที่ส่งมา และโยนงานให้ Background Task จัดการ
    for event in events:
        if isinstance(event, MessageEvent) and isinstance(event.message, TextMessageContent):
            background_tasks.add_task(process_bot_reply, event, channel_access_token)
            
    # ตอบ 200 OK กลับไปให้ LINE ทันที
    return {"status": "ok"}