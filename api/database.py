from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./scopebot.db")

# สร้าง engine เชื่อมต่อ database
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # จำเป็นสำหรับ SQLite
)

# SessionLocal ใช้สำหรับสร้าง session ในแต่ละ request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class สำหรับ models ทั้งหมด
Base = declarative_base()


# Dependency — ใช้ใน router เพื่อรับ db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()