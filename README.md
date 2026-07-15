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

สร้าง database ใน PostgreSQL:

```sql
CREATE DATABASE scopebot;
```

แล้วสร้างตาราง + admin เริ่มต้น:

```bash
python create_admin.py
```

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
- Role-based access: admin, support, user
- Human handoff เมื่อบอทตอบไม่ได้ / ขอคุยเจ้าหน้าที่
- LINE webhook integration
- Admin dashboard + analytics

## Production checklist (ก่อน deploy สาธารณะ)

1. เปลี่ยน `SECRET_KEY` เป็นค่าสุ่มใหม่
2. ตั้ง `CORS_ORIGINS` เป็น domain ของ frontend จริงเท่านั้น
3. ใช้ PostgreSQL ที่ managed (ไม่เปิดพอร์ตสาธารณะโดยไม่จำเป็น)
4. เปลี่ยนรหัส admin เริ่มต้น
5. Serve frontend + API ผ่าน HTTPS
6. (ถัดไป) จัด Alembic migrations ให้ตรง schema ปัจจุบัน

## หมายเหตุเรื่อง venv

โปรเจกต์อาจมีทั้ง `.venv` และ `venv` — **แนะนำใช้แค่ `.venv`** และติดตั้งแพ็กเกจด้วย:

```bash
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
```

เพื่อไม่ให้ `psycopg2` / dependencies หายเพราะใช้ Python คนละตัวกับที่ติดตั้งไว้
