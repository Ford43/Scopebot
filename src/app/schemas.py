from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# --- Schemas สำหรับ Bot ---
class BotBase(BaseModel):
    name: str
    system_prompt: Optional[str] = None
    is_active: bool = True

class BotCreate(BotBase):
    user_id: UUID # ตอนสร้างต้องบอกว่าใครเป็นเจ้าของ

class BotResponse(BotBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True # เพื่อให้แปลงข้อมูลจาก SQLAlchemy Model ได้

# --- Schemas สำหรับ User (ตัวอย่างคร่าวๆ) ---
class UserCreate(BaseModel):
    email: str
    # บังคับว่า password ต้องมีความยาวไม่เกิน 72 ตัวอักษร
    password: str = Field(..., max_length=72)

class UserResponse(BaseModel):
    id: UUID
    email: str
    created_at: datetime

    class Config:
        from_attributes = True
