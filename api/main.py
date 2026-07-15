from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.database import engine, Base
from api.routers import auth, bots, chat
from api.routers import line_webhook
from api.routers import documents
from api.routers import notifications
from api.routers import dashboard
from api.routers import live_chat
import os
from dotenv import load_dotenv

load_dotenv()

# สร้าง table ทั้งหมดอัตโนมัติตอน startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Scope Bot API",
    description="Backend API สำหรับ Scope Bot Platform",
    version="1.0.0",
)

# CORS: รายการ origins คั่นด้วย comma ใน .env
# ตัวอย่าง: CORS_ORIGINS=http://localhost:5173,https://your-domain.com
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_cors_raw = os.getenv("CORS_ORIGINS", _default_origins).strip()
allow_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bots.router)
app.include_router(chat.router)
app.include_router(line_webhook.router)
app.include_router(documents.router)
app.include_router(notifications.router)
app.include_router(dashboard.router)
app.include_router(live_chat.router)


@app.get("/")
def root():
    return {"message": "Scope Bot API is running 🚀"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
