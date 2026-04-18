import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, Text, Integer, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    bots = relationship("Bot", back_populates="owner")

class Bot(Base):
    __tablename__ = "bots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String, nullable=False)
    system_prompt = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="bots")
    line_channel = relationship("LineChannel", back_populates="bot", uselist=False)
    documents = relationship("Document", back_populates="bot")
    sessions = relationship("ChatSession", back_populates="bot")

class LineChannel(Base):
    __tablename__ = "line_channels"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id"), unique=True)
    line_channel_id = Column(String)
    line_channel_secret = Column(String)
    line_channel_access_token = Column(String)
    webhook_url = Column(String)
    
    bot = relationship("Bot", back_populates="line_channel")

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id"))
    file_name = Column(String)
    storage_url = Column(String)
    vector_collection_name = Column(String)
    status = Column(String) # PENDING, PROCESSING, EMBEDDED
    
    bot = relationship("Bot", back_populates="documents")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id"))
    line_user_id = Column(String, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    
    bot = relationship("Bot", back_populates="sessions")
    messages = relationship("Message", back_populates="session")

class Message(Base):
    __tablename__ = "messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"))
    sender_role = Column(String) # user, assistant, system
    content = Column(Text)
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("ChatSession", back_populates="messages")