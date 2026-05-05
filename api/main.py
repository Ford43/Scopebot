from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.database import engine, Base
from api.routers import auth, bots, chat
from api.routers import line_webhook 
from api.routers import documents
from api.routers import notifications 
from api.routers import dashboard  
from api.routers import live_chat

# สร้าง table ทั้งหมดอัตโนมัติตอน startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Scope Bot API",
    description="Backend API สำหรับ Scope Bot Platform",
    version="1.0.0"
)

# อนุญาต CORS สำหรับ Frontend (แก้ origins ตอน deploy จริง)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ลงทะเบียน routers
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