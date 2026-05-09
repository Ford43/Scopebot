from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.core.security import get_password_hash
from app import models, schemas

# ฟังก์ชันสำหรับสร้าง Bot ใหม่
async def create_bot(db: AsyncSession, bot: schemas.BotCreate):
    db_bot = models.Bot(
        user_id=bot.user_id,
        name=bot.name,
        system_prompt=bot.system_prompt,
        is_active=bot.is_active
    )
    db.add(db_bot)
    await db.commit()
    await db.refresh(db_bot)
    return db_bot

# ฟังก์ชันสำหรับดึงข้อมูล Bot ทั้งหมดของ User คนนั้น
async def get_bots_by_user(db: AsyncSession, user_id: UUID):
    result = await db.execute(select(models.Bot).where(models.Bot.user_id == user_id))
    return result.scalars().all()

async def create_user(db: AsyncSession, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        password_hash=hashed_password
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(models.User).where(models.User.email == email))
    return result.scalars().first()