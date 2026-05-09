from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app import crud, schemas
from app.database import get_db

router = APIRouter()

@router.post("/", response_model=schemas.BotResponse)
async def create_bot(bot: schemas.BotCreate, db: AsyncSession = Depends(get_db)):
    # ในระบบจริง ควรตรวจสอบว่า user_id มีอยู่จริงในตาราง users ก่อน
    return await crud.create_bot(db=db, bot=bot)

@router.get("/user/{user_id}", response_model=List[schemas.BotResponse])
async def read_user_bots(user_id: UUID, db: AsyncSession = Depends(get_db)):
    bots = await crud.get_bots_by_user(db, user_id=user_id)
    return bots