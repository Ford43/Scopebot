# ScopeBot: ข้อมูลสำหรับสร้างสไลด์ภาพรวมระบบ

ใช้เอกสารนี้เป็น source of truth สำหรับ AI ที่จะสร้างสไลด์นำเสนอแก่ฝ่าย IT ของบริษัท ข้อมูลมาจากโค้ดและเอกสารใน repository ScopeBot ณ วันที่ 17 กันยายน 2569

## 1. วัตถุประสงค์และบริบทของสไลด์

- **กลุ่มผู้ฟัง:** ฝ่าย IT ที่ต้องประเมินความพร้อม สถาปัตยกรรม การติดตั้ง และการดูแลระบบ
- **เป้าหมาย:** อธิบายว่า ScopeBot ทำงานอย่างไร ข้อมูลเดินทางอย่างไร แต่ละส่วนรับผิดชอบอะไร และฝ่าย IT ต้องเตรียมอะไรสำหรับ pilot
- **ภาษา:** ไทยเป็นหลัก ใช้ชื่อเทคโนโลยีภาษาอังกฤษตามจริง
- **รูปแบบที่ต้องการ:** Diagram เป็นแกนหลักของสไลด์ แล้วมีสไลด์เจาะรายละเอียด Frontend, Backend, Database, AI/RAG, Integration และ Deployment
- **ข้อควรระวัง:** ห้ามใส่ตัวเลขด้านปริมาณผู้ใช้ ประสิทธิภาพ SLA ความแม่นยำ หรือสถานะ production เพราะ repository ไม่มีหลักฐานรองรับ

## 2. ภาพรวมระบบสำหรับ Context Diagram

### ชื่อระบบ

**ScopeBot** คือแพลตฟอร์ม AI Chatbot สำหรับองค์กร ที่ตอบคำถามจากเอกสารภายในด้วย RAG รองรับหลายบอท การส่งต่อเจ้าหน้าที่ และ LINE integration

### Actors และระบบภายนอก

| องค์ประกอบ | บทบาท | การเชื่อมต่อกับ ScopeBot |
|---|---|---|
| ผู้ใช้งาน | ถามคำถามและอ่านคำตอบ | Web chat หรือ LINE Official Account |
| Admin | จัดการผู้ใช้ บอท เอกสาร การตั้งค่า และ dashboard | Web application |
| Support | รับช่วงและตอบบทสนทนาที่ส่งต่อ | Unified live chat บน web application |
| LINE Platform | ส่ง webhook event และรับข้อความตอบกลับ | HTTPS webhook ของ ScopeBot |
| Ollama | ให้บริการ language model สำหรับสร้างคำตอบ | API ติดต่อไปยัง Ollama service |
| PostgreSQL | เก็บข้อมูลเชิงธุรกรรมของระบบ | API ติดต่อฐานข้อมูลภายในระบบ |
| ChromaDB | เก็บ vector index ของเอกสาร | RAG service ใช้ค้นหาส่วนเอกสารที่เกี่ยวข้อง |
| Cloudflare Tunnel | เปิด HTTPS public endpoint สำหรับ web และ LINE | รับ traffic จาก internet ส่งเข้า Docker frontend |

### Prompt สำหรับภาพ Context Diagram

สร้าง diagram แบบ landscape 16:9 โดยวาง `ScopeBot Platform` ไว้กลางภาพ แบ่งระบบภายในเป็น `Web Application`, `FastAPI API`, `RAG Service`, `PostgreSQL`, `ChromaDB` รอบนอกมี `User`, `Admin`, `Support`, `LINE Platform`, `Ollama`, `Cloudflare Tunnel` แสดงทิศทางข้อมูลด้วยเส้นลูกศรและ label สั้น ๆ เช่น `HTTPS`, `Webhook`, `REST API`, `SQL`, `Vector retrieval` ใช้สีแยกกลุ่มดังนี้: user/channel สีฟ้า, application สีม่วง, data สีเขียวอมฟ้า, external AI สีเหลืองอ่อน หลีกเลี่ยงกล่องย่อยจำนวนมากและไม่มีตัวเลขสมมติ

## 3. Container Architecture Diagram

### โครงสร้างหลัก

```text
Browser / LINE
       |
       | HTTPS
       v
Cloudflare Tunnel (เมื่อ deploy แบบ public)
       |
       v
Nginx Frontend Container
       |
       | /api/* reverse proxy
       v
FastAPI API Container
   |        |        |             |
   | SQL    | files  | vectors     | model requests
   v        v        v             v
PostgreSQL  Docker volume  ChromaDB  Ollama on host / separate service
            (uploads)     vector DB
```

### Containers และความรับผิดชอบ

| Container / Service | เทคโนโลยี | หน้าที่ | ข้อมูลเข้าออกหลัก |
|---|---|---|---|
| Web application | React, Vite, Tailwind CSS, shadcn/Radix UI | หน้าจอ chat, admin, dashboard, document library, integration และ live chat | เรียก `/api/*` ผ่าน HTTPS |
| Frontend web server | Nginx | serve static frontend และ reverse proxy `/api/*` ไปยัง API | Browser/Cloudflare → API |
| API service | FastAPI, SQLAlchemy, Alembic | authentication, authorization, bots, documents, chat, LINE webhook, dashboard, notifications, live chat, audit | REST API, webhook, SQL, RAG call |
| Relational database | PostgreSQL 16 | เก็บข้อมูลผู้ใช้ บอท เอกสาร ความสัมพันธ์ ประวัติ session และ audit log | SQL ผ่าน SQLAlchemy |
| File volume | Docker volume `uploads` | เก็บไฟล์เอกสารที่อัปโหลด | API อ่านไฟล์เพื่อ ingest |
| Vector volume | Docker volume `vectordb` | เก็บ ChromaDB index แยกตาม bot | retriever / ingest |
| LLM service | Ollama | รับ context และคำถามเพื่อสร้างคำตอบ | API/RAG เรียกผ่าน Ollama client |
| Cloudflare Tunnel | cloudflared | public HTTPS ingress โดยไม่ต้องเปิด inbound port โดยตรง | internet → frontend:80 |

### ข้อเท็จจริงด้าน deployment

- Docker Compose มี service หลัก 3 ตัว: `db`, `api`, `frontend`
- PostgreSQL ไม่ publish port ออกนอกเครื่องเป็นค่าเริ่มต้น
- API publish ที่ port `8000`; frontend publish ที่ port `80` โดย default
- API เชื่อม Ollama ผ่าน `http://host.docker.internal:11434` ใน Docker configuration
- API และ frontend ใช้ Docker volumes เพื่อเก็บ uploads และ vector database
- Nginx ตั้ง `client_max_body_size 12m`; application จำกัดไฟล์อัปโหลดที่ 10 MB
- Cloudflare Named Tunnel เหมาะเมื่อใช้ LINE เพราะ URL คงที่; Quick Tunnel ใช้ทดสอบชั่วคราวเพราะ URL เปลี่ยนเมื่อ restart

## 4. Frontend Diagram และคำอธิบาย

### เทคโนโลยี

- React 18
- Vite
- React Router
- Tailwind CSS
- shadcn/Radix UI
- มี Material UI packages ใน dependency ด้วย

### หน้าจอและความสามารถ

| หน้าจอ / ส่วน | หน้าที่ |
|---|---|
| Login, Sign up, Forgot password, Reset password | จัดการการยืนยันตัวตนและการกู้รหัสผ่าน |
| Chat interface | เลือกบอท ส่งคำถาม แสดงคำตอบ แหล่งอ้างอิง และสถานะ bot/waiting/human |
| Bots | สร้าง แก้ไข เปิด/ปิดบอท และจัดการ system prompt |
| Documents | อัปโหลด จัดหมวดหมู่ ลบ และผูกเอกสารเข้ากับบอท |
| Integration | ตั้งค่าและเปิดใช้ LINE สำหรับแต่ละบอท |
| Dashboard / Analytics | แสดงสถิติระบบ สถิติรายบอท และคำถามที่พบบ่อย |
| Unified Chat | หน้าจอให้ support ดู session, รับช่วงสนทนา, ตอบ และจบ session |
| Search History | ดูประวัติการสนทนา |
| User Management | อนุมัติผู้ใช้ เปลี่ยนบทบาท จัดการ quota จำนวนบอท |
| Notifications | แสดงรายการแจ้งเตือนและจำนวนที่ยังไม่อ่าน |

### Frontend flow ที่ควรใช้สร้างภาพ

```text
User action
  → React component / custom hook
  → API client
  → FastAPI endpoint
  → response: answer + sources + session mode
  → UI แสดงคำตอบหรือสถานะ waiting/human
```

### จุดสำคัญสำหรับภาพ Frontend

- หน้า chat มี state ของการสนทนา 3 แบบ: `bot`, `waiting`, `human`
- หน้า chat แสดง sources ที่มากับคำตอบ RAG ได้
- หน้า document upload มี confirm ก่อนแทนที่เอกสารชื่อซ้ำ และแจ้งว่าบอทที่ใช้เอกสารนั้นจะ reindex
- protected routes ใช้กับเส้นทางที่ต้อง login

### Prompt สำหรับภาพ Frontend

สร้าง diagram แบบ layer เดียว โดยแสดง Browser UI ด้านซ้าย และ API client ด้านขวา ใต้ Browser UI ให้มีหน้าจอ 6 กลุ่มคือ Authentication, Chat, Bot Management, Document Library, Admin Dashboard, Unified Live Chat ใช้เส้นเชื่อมทั้งหมดไปที่ API client แล้วส่งต่อ FastAPI อย่าทำเป็น mockup ที่มีข้อมูลลูกค้าจริง และอย่าใส่ปุ่ม UI ละเอียดเกินจำเป็น

## 5. Backend Diagram และคำอธิบาย

### เทคโนโลยี

- Python
- FastAPI
- SQLAlchemy ORM
- Alembic migrations
- JWT authentication ด้วย HS256
- CORS middleware

### Router / API modules

| Module | Base path | ความรับผิดชอบ |
|---|---|---|
| Auth | `/api/auth` | register, login, forgot/reset password, current user, user approval, role management |
| Bots | `/api/bots` | create/read/update/delete bot, attach document, reindex, toggle web/LINE |
| Chat | `/api/chat` | รับคำถาม, ตรวจสิทธิ์, เรียก RAG, บันทึก conversation, handoff state |
| Documents | `/api/documents` | upload, list, category, delete, assign/unassign bot |
| LINE Webhook | `/api/line/webhook/{bot_id}` | ตรวจ signature, รับ event, เรียก RAG, reply/push message |
| Live Chat | `/api/live` | list/get session, staff reply, end session |
| Dashboard | `/api/dashboard` | system stats, bot stats, top questions |
| Notifications | `/api/notifications` | list, unread count, clear notification |
| Audit | `/api/audit-logs` | admin audit log |

### Authentication และ authorization

- Token: JWT `HS256`
- มี role 3 ประเภท: `admin`, `support`, `user`
- ผู้ใช้ใหม่มีสถานะ `is_approved=false` โดย default
- API ตรวจว่า account ยัง active ก่อนใช้งาน endpoint ที่ต้องยืนยันตัวตน
- `admin` จัดการ user, role, bot และ dashboard ได้
- `support` ทำงานกับ live chat และเข้าถึงบอทตามสิทธิ์
- `user` ใช้งานบอทที่เข้าถึงได้

### Prompt สำหรับภาพ Backend

สร้าง diagram แนวนอน แบ่ง FastAPI API เป็น 3 กลุ่ม: `Identity & Access`, `Business APIs`, `Operational APIs` กลุ่มแรกประกอบด้วย Auth และ JWT/RBAC กลุ่มกลางประกอบด้วย Bots, Documents, Chat, LINE Webhook, Live Chat กลุ่มสุดท้ายประกอบด้วย Dashboard, Notifications, Audit Logs แสดง FastAPI เป็นชั้นกลางที่เรียก PostgreSQL และ RAG Service หลีกเลี่ยงการแสดงทุก endpoint เป็นกล่องแยก ให้กลุ่มละ 1 กล่องและระบุหน้าที่สั้น ๆ

## 6. Database Diagram และคำอธิบาย

### ฐานข้อมูลหลัก

ใช้ PostgreSQL ใน deployment ที่แนะนำ และใช้ SQLAlchemy เป็น ORM; SQLite ใช้ได้เป็นทางเลือกสำหรับ development

### Entities ที่ควรแสดงใน ER Diagram

| Entity | ฟิลด์สำคัญ | ความสัมพันธ์ / จุดประสงค์ |
|---|---|---|
| `users` | id, email, username, hashed_password, role, is_approved, is_active, max_bots | owner ของ bots/documents และผู้รับ notifications |
| `bots` | id, bot_id, name, description, status, system_prompt, is_line_connected, is_web_connected, line credentials, owner_id | เป็นศูนย์กลางของ knowledge, chat และ LINE integration |
| `documents` | id, filename, file_path, file_size, category, owner_id | เอกสารเป็นของ user และสามารถผูกกับหลายบอท |
| `bot_documents` | bot_id, document_id | ตาราง many-to-many ระหว่าง bots และ documents |
| `conversations` | session_id, question, answer, is_answered_by_bot, is_resolved, source_channel, bot_id, created_at | เก็บคำถาม/คำตอบและสถานะการแก้ปัญหา |
| `live_sessions` | line_user_id, display_name, bot_id, mode, is_active, started_at, ended_at | เก็บ session สำหรับ human handoff |
| `live_messages` | session_id, sender_type, sender_name, message, created_at | เก็บข้อความ customer/bot/staff ใน session |
| `notifications` | user_id, title, message, type, is_read, created_at | ใช้แจ้งเตือนในระบบ |
| `password_reset_tokens` | user_id, token_hash, expires_at, used_at | token reset password แบบใช้ครั้งเดียว |
| `audit_logs` | actor_id, action, target_user_id, detail, created_at | บันทึกการดำเนินการด้านการจัดการผู้ใช้ |

### ความสัมพันธ์ที่ต้องวาด

```text
User 1 ── * Bot
User 1 ── * Document
Bot * ── * Document ผ่าน bot_documents
Bot 1 ── * Conversation
Bot 1 ── * LiveSession
LiveSession 1 ── * LiveMessage
User 1 ── * Notification
User 1 ── * PasswordResetToken
User 0..1 ── * AuditLog (actor)
```

### Prompt สำหรับภาพ Database

สร้าง ER diagram อ่านง่าย ใช้ `bots` เป็น entity กลาง เชื่อมกับ `users`, `documents` ผ่าน `bot_documents`, `conversations` และ `live_sessions` ให้แสดงเฉพาะ primary key, foreign key และฟิลด์ที่อธิบายหน้าที่ได้ ไม่ต้องแสดงทุก field เช่น password hash หรือ LINE secret แบบละเอียด ใช้ crow's foot หรือ label `1` และ `many` ให้ชัด

## 7. AI / RAG Diagram และคำอธิบาย

### องค์ประกอบ RAG

| ขั้นตอน | ข้อมูลจริงในระบบ |
|---|---|
| Upload | รองรับ PDF, DOCX, TXT, CSV; application จำกัดขนาดไฟล์ 10 MB |
| Load | อ่านเอกสารที่เชื่อมกับบอท |
| Chunking | ค่าเริ่มต้น chunk size 1,000 และ overlap 200 |
| Embedding | BAAI/bge-m3 ผ่าน HuggingFace embeddings |
| Vector storage | ChromaDB, แยก persist directory ตาม `bot_id` |
| Retrieval | similarity search; ค่า `TOP_K=5`, fetch อย่างน้อย 8 แล้วกรองด้วย distance threshold |
| Answer generation | Ollama model; default `qwen2.5:1.5b` ใน Docker Compose |
| Sources | ส่งชื่อไฟล์และ snippet กลับไปแสดงกับคำตอบได้สูงสุด 3 แหล่ง |

### RAG query flow

```text
User question + recent conversation context
  → retrieve_docs(query, bot_id)
  → ChromaDB similarity search
  → top relevant document chunks
  → construct prompt with retrieved context
  → Ollama chat model
  → answer + source filename/snippet
  → FastAPI response to web or LINE
```

### Behavior เมื่อไม่มีคำตอบหรือบริการ AI มีปัญหา

- หากค้นหาเอกสารไม่พบ ระบบคืนสถานะให้ส่งต่อเจ้าหน้าที่
- Web chat แสดงตัวเลือกให้ผู้ใช้กดติดต่อเจ้าหน้าที่
- LINE สามารถสร้าง live session เพื่อรอเจ้าหน้าที่
- หาก retrieval หรือ language model ใช้งานไม่ได้ ระบบแยกกรณี service failure ออกจากกรณีตอบได้ เพื่อไม่บันทึกผลลัพธ์ว่าเป็นคำตอบที่สำเร็จ
- มีการส่ง conversation history ล่าสุดเข้าไปช่วยเข้าใจคำถามต่อเนื่อง แต่ใช้เอกสารที่ค้นพบเป็นแหล่งข้อเท็จจริง

### Prompt สำหรับภาพ RAG

สร้าง process diagram 2 เลน: `Knowledge ingestion` และ `Question answering` เลนแรก: Upload document → Load → Chunk → BGE-M3 embedding → ChromaDB per bot เลนสอง: User question + recent context → Similarity search → Relevant chunks → Prompt assembly → Ollama → Answer + sources หรือ Handoff ใช้ลูกศรจาก ChromaDB ไปยัง Similarity search และแสดงว่า knowledge index แยกตาม bot

## 8. Live Chat และ LINE Integration Diagram

### สถานะ live session

```text
bot
  └─ ผู้ใช้ขอเจ้าหน้าที่ หรือ RAG ไม่พบคำตอบบน LINE
       → waiting
          └─ เจ้าหน้าที่ตอบครั้งแรก
               → human
                  └─ เจ้าหน้าที่จบ session
                       → bot (ปิด active session)
```

### LINE flow

```text
LINE user message
  → LINE Platform
  → POST /api/line/webhook/{bot_id}
  → verify X-Line-Signature ด้วย channel secret
  → create/find LiveSession
  → save LiveMessage
  → RAG หรือ human handoff flow
  → reply_message หรือ push_message ผ่าน LINE Messaging API
```

### ข้อเท็จจริงสำคัญ

- LINE credentials เก็บในระดับ bot เพื่อให้แต่ละบอทผูกกับ channel ของตนได้
- webhook ต้องเป็น HTTPS เช่น `https://YOUR_DOMAIN/api/line/webhook/{bot_id}`
- ก่อนเปิดใช้ LINE ต้องตั้ง channel token, channel secret และเปิดการเชื่อมต่อของบอท
- เมื่อเจ้าหน้าที่ตอบ ระบบบันทึกข้อความเป็น `staff` และสามารถ push ข้อความกลับไปที่ LINE ได้

### Prompt สำหรับภาพ Integration

สร้าง sequence diagram 2 ส่วน: ส่วนบนแสดง LINE user → LINE platform → ScopeBot webhook → RAG/Database → LINE reply ส่วนล่างแสดง exception path เมื่อไม่พบคำตอบ: ScopeBot creates `LiveSession: waiting` → notification to operator → support reply → `LiveSession: human` → LINE push message ให้ใช้เส้นทางปกติสีฟ้าและเส้นทาง handoff สีม่วง

## 9. Security และ Operations Diagram

### สิ่งที่มีในโค้ดหรือ configuration

- JWT authentication, algorithm HS256
- role-based access control สำหรับ admin, support, user
- user approval และ active/inactive account state
- CORS allowlist กำหนดจาก `CORS_ORIGINS`
- secret values อยู่ใน environment variables เช่น `SECRET_KEY`, database password, admin password, SMTP credential, LINE credential, Cloudflare token
- HTTPS ผ่าน Cloudflare Tunnel สำหรับ public deployment
- Audit log สำหรับการจัดการผู้ใช้ เช่น การเปลี่ยน role
- Password reset token เก็บ hash, expiry และ used timestamp
- Docker volumes แยกสำหรับ PostgreSQL data, uploads และ vector DB

### ข้อควรระวังในการสื่อสาร

- อย่าอ้างว่าระบบมี SSO, MFA, encryption at rest, WAF, SIEM, backup automation, rate limiting หรือ secret vault เพราะไม่ได้ยืนยันจาก repository
- อย่าแสดง database หรือ Ollama ว่า accessible จาก public internet; architecture Docker ที่ให้มาไม่เปิด PostgreSQL port ภายนอกโดย default
- เป้าหมาย production ต้องตั้ง `DEBUG=false`, ใช้ secret ใหม่, จำกัด CORS ให้ตรง domain, ตั้ง SMTP และทดสอบ HTTPS / smoke test

## 10. ลำดับสไลด์ที่แนะนำสำหรับ AI ทำสไลด์

1. **ScopeBot Overview** — วัตถุประสงค์ ระบบตอบคำถามจากเอกสารด้วย RAG และช่องทาง web/LINE
2. **System Context Diagram** — actors และ external systems
3. **Container Architecture** — browser, Cloudflare, Nginx, FastAPI, PostgreSQL, ChromaDB, Ollama
4. **Frontend** — ส่วนของ UI และเส้นทางเรียก API
5. **Backend** — FastAPI modules, JWT/RBAC, business flows
6. **Database ER Diagram** — entities และความสัมพันธ์หลัก
7. **RAG Pipeline** — ingestion และ question answering
8. **Live Chat & LINE Integration** — session state และ sequence flow
9. **Deployment and Operations** — Docker Compose, volumes, HTTPS tunnel, environment configuration
10. **IT Pilot Readiness** — domain/HTTPS, Ollama, PostgreSQL, admin/support account, curated documents, CORS/secrets

## 11. Master Prompt สำหรับส่งให้ AI สร้างสไลด์

```text
สร้างสไลด์ภาษาไทย 10 หน้า สำหรับนำเสนอฝ่าย IT ของบริษัทเกี่ยวกับ ScopeBot ซึ่งเป็นแพลตฟอร์ม AI Chatbot สำหรับองค์กร ใช้ diagram เป็นองค์ประกอบหลักและแยกอธิบาย Frontend, Backend, Database, RAG, LINE Integration และ Deployment ให้ชัดเจน

ผู้ฟังคือฝ่าย IT จึงต้องการคำอธิบายเชิงสถาปัตยกรรมที่ถูกต้องและกระชับ ไม่มีคำโฆษณา ไม่มี KPI หรือ claim ด้านความเร็ว/ความแม่นยำที่ไม่มีข้อมูลรองรับ

สไตล์: 16:9, พื้นหลังเข้ม, สีฟ้า-ม่วงเป็น accent, ตัวอักษรไทยอ่านง่าย, ใช้ diagram แบบ clean enterprise architecture, ไม่ทำให้ดูเป็น dashboard และไม่ใส่ข้อมูลผู้ใช้จริง

เนื้อหาที่ต้องใช้:
- Frontend: React 18, Vite, React Router, Tailwind CSS, shadcn/Radix UI
- Frontend served by Nginx; Nginx reverse proxy /api/* to FastAPI
- Backend: FastAPI, SQLAlchemy, Alembic, JWT HS256, CORS middleware
- API modules: Auth, Bots, Documents, Chat, LINE webhook, Live Chat, Dashboard, Notifications, Audit
- PostgreSQL เก็บ users, bots, documents, bot_documents, conversations, live_sessions, live_messages, notifications, password_reset_tokens, audit_logs
- RAG: PDF/DOCX/TXT/CSV, max 10 MB, chunk size 1000, overlap 200, BAAI/bge-m3, ChromaDB per bot, TOP_K 5, Ollama default qwen2.5:1.5b, answer returns source filename/snippet
- Live session states: bot → waiting → human → bot when closed
- LINE webhook: POST /api/line/webhook/{bot_id}, verifies X-Line-Signature, saves message, answers through RAG or sends to support
- Docker: db (PostgreSQL 16), api, frontend; volumes for pgdata/uploads/vectordb; API talks to Ollama at host.docker.internal:11434 in Docker
- Public deployment: Cloudflare Tunnel → frontend:80; HTTPS required for LINE; PostgreSQL is not exposed externally by default
- Production/pilot controls: DEBUG=false, fresh secret, strict CORS, SMTP, admin/support accounts, curated knowledge documents, smoke test

Create these slides in order:
1) overview, 2) context diagram, 3) container architecture, 4) frontend, 5) backend, 6) database ER diagram, 7) RAG pipeline, 8) live chat and LINE sequence, 9) deployment, 10) IT pilot readiness

For every diagram, label the direction of data flow. Do not claim SSO, MFA, encryption at rest, WAF, SIEM, backups, rate limiting, SLA, user count, response time, or model accuracy.
```

## 12. แหล่งอ้างอิงใน repository

- `README.md` — ขอบเขตระบบ, tech stack, features, pilot checklist, deployment
- `.env.example` — RAG, model, database, JWT, CORS, runtime configuration
- `docker-compose.yml` — containers, volumes, ports และ environment variables
- `deploy/DEPLOY.md` และ `deploy/nginx.conf` — Cloudflare Tunnel, HTTPS, Nginx routing
- `api/main.py` — FastAPI app, routers, CORS
- `api/models.py` — database entities และ relationships
- `api/routers/*.py` — API responsibilities, chat flow, documents, LINE, live chat
- `rag/rag_pipeline.py`, `rag/retriever.py`, `rag/ingest.py` — RAG processing flow
- `src/app/routes.tsx`, `src/app/components/`, `src/app/hooks/useChatSession.ts` — frontend routes, UI functions และ chat states
