from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from api.database import Base
import enum


class UserRole(str, enum.Enum):
    user = "user"
    support = "support"
    admin = "admin"


class BotStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    processing = "processing"


# ตารางเชื่อม Bot <-> Document (many-to-many)
bot_documents = Table(
    "bot_documents",
    Base.metadata,
    Column("bot_id", Integer, ForeignKey("bots.id"), primary_key=True),
    Column("document_id", Integer, ForeignKey("documents.id"), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user)
    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    max_bots = Column(Integer, default=3)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bots = relationship("Bot", back_populates="owner", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Bot(Base):
    __tablename__ = "bots"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(BotStatus), default=BotStatus.inactive)
    system_prompt = Column(Text, nullable=True)
    is_line_connected = Column(Boolean, default=False)
    is_web_connected = Column(Boolean, default=False)
    line_channel_token = Column(String, nullable=True)
    line_channel_secret = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="bots")
    documents = relationship("Document", secondary=bot_documents, back_populates="bots")
    conversations = relationship("Conversation", back_populates="bot", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    category = Column(String, nullable=True, default="ทั่วไป")  # user กำหนดเอง
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # เปลี่ยนจาก bot_id
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="documents")
    bots = relationship("Bot", secondary=bot_documents, back_populates="documents")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    is_answered_by_bot = Column(Boolean, default=True)
    is_resolved = Column(Boolean, default=False)
    source_channel = Column(String, default="web")
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bot = relationship("Bot", back_populates="conversations")


# =====================
# Table: notifications (ใหม่)
# =====================
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="info")   # info, warning, danger, success
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")

# ===== Live Session (Human Handoff) =====
class SessionMode(str, enum.Enum):
    bot = "bot"
    waiting = "waiting"    # ลูกค้ากดติดต่อแล้ว รอเจ้าหน้าที่
    human = "human"        # เจ้าหน้าที่กำลังคุยอยู่


class LiveSession(Base):
    __tablename__ = "live_sessions"

    id = Column(Integer, primary_key=True, index=True)
    line_user_id = Column(String, index=True, nullable=False)  # userId จาก Line
    line_display_name = Column(String, nullable=True)          # ชื่อลูกค้า
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False)
    mode = Column(Enum(SessionMode), default=SessionMode.bot)
    is_active = Column(Boolean, default=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    bot = relationship("Bot")
    messages = relationship("LiveMessage", back_populates="session", cascade="all, delete-orphan")


class SenderType(str, enum.Enum):
    customer = "customer"
    bot = "bot"
    staff = "staff"


class LiveMessage(Base):
    __tablename__ = "live_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("live_sessions.id"), nullable=False)
    sender_type = Column(Enum(SenderType), nullable=False)
    sender_name = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("LiveSession", back_populates="messages")