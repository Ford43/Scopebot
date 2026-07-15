# Scopebot

แพลตฟอร์ม AI chatbot สำหรับองค์กร รองรับ RAG, multi-bot, live chat handoff และ LINE integration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS, shadcn/Radix UI |
| Backend | FastAPI, SQLAlchemy, Alembic |
| AI | Ollama + ChromaDB + BGE-M3 (RAG) |

## Project Structure

```
Scopebot/
├── api/                  # FastAPI backend (active)
├── rag/                  # RAG pipeline (embed, retrieve, ingest)
├── src/
│   └── app/
│       ├── components/
│       │   ├── admin/    # Dashboard, UnifiedChat, etc.
│       │   ├── auth/     # Login, Signup pages
│       │   ├── chat/     # Chat UI components
│       │   └── ui/       # shadcn UI primitives
│       ├── constants/    # App constants
│       ├── contexts/     # React contexts (Auth)
│       ├── hooks/        # Custom hooks
│       ├── lib/          # Shared utilities (API helpers)
│       ├── types/        # TypeScript types
│       └── utils/        # Helper functions
├── migrations/           # Alembic DB migrations
└── test/                 # Backend tests
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- [Ollama](https://ollama.com/) with model pulled (e.g. `qwen2.5:7b`)

### Backend

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn api.main:app --reload --port 8000
```

### Frontend

```bash
npm install
npm run dev
```

Frontend dev server proxies `/api` requests to `http://127.0.0.1:8000`.

## Features

- Multi-bot management with document upload (RAG)
- Role-based access: admin, support, user
- Human handoff when bot cannot answer
- LINE webhook integration
- Admin dashboard with analytics
