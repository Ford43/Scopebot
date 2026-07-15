# Scopebot

แพลตฟอร์ม AI chatbot สำหรับองค์กร รองรับ RAG, multi-bot, live chat handoff และ LINE integration

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS, shadcn/Radix UI |
| Backend | FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL (แนะนำ) |
| AI | Ollama + ChromaDB + BGE-M3 (RAG) |

## Project Structure

```
Scopebot/
├── api/              # FastAPI backend (active)
├── rag/              # RAG pipeline (embed, retrieve, ingest)
├── src/app/          # React frontend
├── migrations/       # Alembic DB migrations
└── test/             # Backend tests
```

## Prerequisites

- Node.js 18+
- Python 3.10+ (แนะนำใช้ virtualenv เดียว: `.venv`)
- PostgreSQL รันอยู่บนเครื่อง
- [Ollama](https://ollama.com/) และดึง model แล้ว เช่น `ollama pull qwen2.5:1.5b`

## Setup

### 1) Environment

```bash
# ใช้ .venv เป็นหลัก
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# ติดตั้ง dependencies
pip install -r requirements.txt
cp .env.example .env
```

แก้ค่าใน `.env` อย่างน้อย:
- `DATABASE_URL` — user/password PostgreSQL ของคุณ
- `SECRET_KEY` — สร้างด้วย `python -c "import secrets; print(secrets.token_hex(32))"`
- `CORS_ORIGINS` — domain frontend (ตอน deploy ให้ใส่ URL จริง)
- `MODEL_NAME` — ชื่อ model ใน Ollama

### 2) Database + Admin

**Database ใหม่ (แนะนำ production):**

```bash
alembic upgrade head
python create_admin.py
```

**Database ที่มีตารางอยู่แล้ว (จาก create_all ก่อนหน้า):**

```bash
alembic stamp head
```

**Development แบบง่าย:** ตั้ง `AUTO_CREATE_TABLES=true` ใน `.env` แล้วรัน `python create_admin.py`

| Field | Value |
|-------|-------|
| Email | `admin@scopebot.com` |
| Password | `admin1234` |

### 3) รัน Backend (พอร์ต 8000)

```bash
.\.venv\Scripts\Activate.ps1
uvicorn api.main:app --reload --port 8000
```

ตรวจว่าขึ้น: `Uvicorn running on http://127.0.0.1:8000`  
Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 4) รัน Frontend (พอร์ต 5173)

เปิด terminal อีกอัน:

```bash
npm install
npm run dev
```

Vite จะ proxy `/api` ไปที่ `http://127.0.0.1:8000` — **ต้องรัน backend ค้างไว้ด้วย** ไม่งั้น login จะได้ `ECONNREFUSED`

## Features

- Multi-bot management + อัปโหลดเอกสาร (RAG)
- Role-based access: admin, support, user (สมัครแล้วรออนุมัติ)
- Human handoff เมื่อบอทตอบไม่ได้ / ขอคุยเจ้าหน้าที่
- LINE webhook integration
- Admin dashboard + analytics
- ลืมรหัสผ่าน / รีเซ็ตผ่านอีเมล (หรือแจ้ง admin หากยังไม่มี SMTP)
- แผงการแจ้งเตือนใน top bar

## Company pilot checklist

1. คัดลอก `.env.example` → `.env` แล้วตั้งค่าอย่างน้อย:
   - `SECRET_KEY` (สุ่มใหม่)
   - `DATABASE_URL` / `POSTGRES_PASSWORD`
   - `CORS_ORIGINS` + `FRONTEND_URL` ให้ตรง URL ที่ผู้ใช้เปิดจริง
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (รหัสแข็งแรง — อย่าใช้ค่า default)
2. `AUTO_CREATE_TABLES=false` แล้วรัน `alembic upgrade head` และ `python create_admin.py`
3. (แนะนำ) ตั้ง SMTP เพื่อให้ลืมรหัสผ่านส่งอีเมลได้ — ถ้ายังไม่มี SMTP:
   - ระบบจะแจ้ง admin ในกระดิ่งแจ้งเตือน
   - หรือตั้ง `DEBUG=true` ชั่วคราวเพื่อได้ `dev_reset_url` ตอนทดสอบ
4. เปลี่ยนรหัส admin ทันทีหลังสร้าง (`ADMIN_UPDATE_PASSWORD=true` ได้ครั้งเดียว)
5. รัน smoke test: `python scripts/smoke_test.py`
6. Serve ผ่าน HTTPS (หรือ VPN ภายในบริษัท)
7. Ollama ต้องเข้าถึงได้จาก API (host หรือ service แยก)
8. สร้างบัญชี support แล้วอนุมัติ user ของแผนกก่อนเปิดใช้

## Production checklist (ก่อนเปิดสาธารณะนอก pilot)

1. `DEBUG=false` และอย่าเปิด `VITE_SHOW_DEMO_ACCOUNTS`
2. ตั้ง SMTP จริง + ตรวจ flow ลืมรหัสผ่าน end-to-end
3. Serve frontend + API ผ่าน HTTPS
4. จำกัด CORS เฉพาะ domain ที่ใช้
5. รัน smoke test อีกครั้งหลัง deploy

## Deploy ด้วย Docker

```bash
# สร้าง .env สำหรับ production (อย่างน้อย SECRET_KEY, POSTGRES_PASSWORD, CORS_ORIGINS)
docker compose up --build -d
```

- Frontend: http://localhost (พอร์ต 80)
- API: http://localhost:8000
- PostgreSQL: พอร์ต 5432

**หมายเหตุ:** Ollama ต้องรันบน host (`host.docker.internal:11434`) หรือเพิ่ม service แยก — RAG จะใช้งานไม่ได้ถ้าไม่มี Ollama

## หมายเหตุเรื่อง venv

โปรเจกต์อาจมีทั้ง `.venv` และ `venv` — **แนะนำใช้แค่ `.venv`** และติดตั้งแพ็กเกจด้วย:

```bash
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
```

เพื่อไม่ให้ `psycopg2` / dependencies หายเพราะใช้ Python คนละตัวกับที่ติดตั้งไว้
