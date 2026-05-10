from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from api.models import UserRole, BotStatus


# =====================
# Auth Schemas
# =====================
class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    role: UserRole
    is_approved: bool
    is_active: bool
    max_bots: int
    created_at: datetime

    class Config:
        from_attributes = True


# =====================
# Bot Schemas
# =====================
class BotCreate(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None


class BotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    line_channel_token: Optional[str] = None
    line_channel_secret: Optional[str] = None
    system_prompt: Optional[str] = None


class BotOut(BaseModel):
    id: int
    bot_id: str
    name: str
    description: Optional[str]
    status: BotStatus
    is_line_connected: bool
    is_web_connected: bool
    owner_id: int
    created_at: datetime
    system_prompt: Optional[str] = None

    class Config:
        from_attributes = True


# =====================
# Chat Schemas
# =====================
class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    source_channel: Optional[str] = "web"


class ChatResponse(BaseModel):
    answer: str
    is_answered_by_bot: bool
    conversation_id: int


# =====================
# Conversation Schemas
# =====================
class ConversationOut(BaseModel):
    id: int
    question: str
    answer: str
    is_answered_by_bot: bool
    is_resolved: bool
    source_channel: str
    created_at: datetime

    class Config:
        from_attributes = True


# =====================
# Support/Admin Schemas
# =====================
class ApproveUser(BaseModel):
    is_approved: bool
    is_active: Optional[bool] = None
    max_bots: Optional[int] = 3
    role: Optional[str] = None

# =====================
# Document Schemas (ใหม่)
# =====================
class DocumentOut(BaseModel):
    id: int
    filename: str
    file_size: Optional[int]
    category: Optional[str]
    owner_id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    category: Optional[str] = None


# =====================
# Notification Schemas (ใหม่)
# =====================
class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# =====================
# Live Session Schemas
# =====================
class LiveMessageOut(BaseModel):
    id: int
    sender_type: str
    sender_name: Optional[str]
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class LiveSessionOut(BaseModel):
    id: int
    line_user_id: str
    line_display_name: Optional[str]
    bot_id: int
    bot_name: Optional[str] = None      
    bot_description: Optional[str] = None 
    mode: str
    is_active: bool
    started_at: datetime
    messages: list[LiveMessageOut] = []
    last_question: Optional[str] = None  

    class Config:
        from_attributes = True


class StaffReply(BaseModel):
    message: str

    @validator("message")
    def clean_message(cls, v):
        # แปลง line break ทุกรูปแบบให้เป็น \n
        return v.replace("\r\n", "\n").replace("\r", "\n").strip()