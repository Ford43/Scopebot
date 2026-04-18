from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# รูปแบบ: postgresql+asyncpg://user:password@host:port/dbname
DATABASE_URL = "postgresql+asyncpg://postgres:ford2543@localhost/scopebot"

engine = create_async_engine(DATABASE_URL, echo=True)

# สร้าง Session factory สำหรับใช้งานใน API
AsyncSessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()

# Dependency สำหรับใช้ใน FastAPI Endpoints
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session