# ScopeBot: Prompt สำหรับวางใน Gamma โดยตรง

คัดลอกข้อความในกรอบด้านล่างทั้งหมด แล้ววางใน Gamma เพื่อสร้างสไลด์

---

สร้างงานนำเสนอภาษาไทย 10 สไลด์ อัตราส่วน 16:9 สำหรับนำเสนอฝ่าย IT ของบริษัท หัวข้อ **“ScopeBot: ภาพรวมสถาปัตยกรรมระบบ AI Chatbot สำหรับองค์กร”**

เป้าหมายของงานคืออธิบายภาพรวมระบบและแยกอธิบาย Frontend, Backend, Database, AI/RAG, Live Chat, LINE Integration และ Deployment ให้ทีม IT เห็นการไหลของข้อมูลและสิ่งที่ต้องเตรียมก่อนทำ pilot

ใช้สไตล์ professional enterprise architecture: พื้นหลังสีเข้ม, สีฟ้าและม่วงเป็นสีเน้น, ตัวอักษรไทยอ่านง่าย, แผนภาพเรียบและอ่านง่าย, ไม่ทำหน้าตาแบบ dashboard, ไม่มีรูปคนหรือข้อมูลผู้ใช้จริง, มี data-flow arrows ทุกแผนภาพ

ข้อกำหนดด้านความถูกต้อง: ใช้เฉพาะข้อมูลที่ให้ด้านล่าง ห้ามใส่ตัวเลขสมมติ ห้ามอ้างว่าเป็น production-ready และห้ามอ้างว่ามี SSO, MFA, encryption at rest, WAF, SIEM, backup automation, rate limiting, SLA, ความแม่นยำของโมเดล หรือจำนวนผู้ใช้

## Slide 1 — ScopeBot Overview

หัวข้อ: ScopeBot: AI Chatbot สำหรับความรู้ภายในองค์กร

เนื้อหา:
- ตอบคำถามจากเอกสารองค์กรด้วย RAG
- รองรับหลายบอท เอกสารแยกตามบอท และ system prompt ต่อบอท
- ใช้งานผ่าน Web chat และ LINE Official Account
- ส่งต่อการสนทนาให้เจ้าหน้าที่เมื่อไม่พบคำตอบหรือผู้ใช้ขอความช่วยเหลือ

ภาพ: ใช้ภาพระบบแบบเรียบที่มี User, Documents, AI, Web/LINE และ Support เชื่อมเข้าหา ScopeBot ตรงกลาง

## Slide 2 — System Context Diagram

หัวข้อ: System Context

สร้าง context diagram โดยวาง `ScopeBot Platform` ไว้กลางภาพ

องค์ประกอบภายนอก:
- User: ถามผ่าน Web chat หรือ LINE
- Admin: จัดการผู้ใช้ บอท เอกสาร และ dashboard ผ่าน web
- Support: รับช่วง live chat ผ่าน web
- LINE Platform: ส่ง webhook event และรับ reply/push message
- Ollama: สร้างคำตอบจาก prompt และ retrieved context
- Cloudflare Tunnel: รับ HTTPS public traffic ไปยัง frontend

องค์ประกอบภายใน ScopeBot:
- Web Application
- FastAPI API
- PostgreSQL
- ChromaDB

ใส่ label บนเส้นเชื่อม: HTTPS, Webhook, REST API, SQL, Vector retrieval, Model request

## Slide 3 — Container Architecture

หัวข้อ: Container Architecture และการไหลของข้อมูล

สร้างแผนภาพตามโครงสร้างนี้:

Browser / LINE
→ Cloudflare Tunnel เมื่อเปิด public deployment
→ Nginx Frontend Container
→ `/api/*` reverse proxy
→ FastAPI API Container
→ PostgreSQL สำหรับข้อมูลธุรกรรม
→ Uploads volume สำหรับไฟล์เอกสาร
→ ChromaDB / vector database volume สำหรับ index
→ Ollama service สำหรับ language model

รายละเอียดที่ต้องใส่:
- Docker Compose มี `db`, `api`, `frontend`
- PostgreSQL ไม่เปิด port ออกนอกเครื่องเป็นค่าเริ่มต้น
- API อยู่ port 8000; frontend อยู่ port 80 โดย default
- ใน Docker, API ติดต่อ Ollama ที่ `host.docker.internal:11434`
- ใช้ Docker volumes แยก `pgdata`, `uploads`, `vectordb`

## Slide 4 — Frontend

หัวข้อ: Frontend Application

เทคโนโลยี: React 18, Vite, React Router, Tailwind CSS, shadcn/Radix UI

กลุ่มหน้าจอ:
- Authentication: login, sign up, forgot/reset password
- Chat interface: เลือกบอท ส่งคำถาม แสดงคำตอบและแหล่งอ้างอิง
- Bot management: สร้างและตั้งค่าบอท
- Document library: upload, category, assign document to bot
- Admin: dashboard, analytics, user management, notifications
- Unified live chat: รับช่วง ตอบ และจบ session
- Integration: ตั้งค่า LINE ต่อบอท

วาด browser application ด้านซ้าย เชื่อม API client ด้านขวา แล้วส่งต่อ FastAPI ใช้ประโยคสั้นว่า `คำตอบ API ประกอบด้วย answer, sources และ session mode`

## Slide 5 — Backend

หัวข้อ: FastAPI Backend

เทคโนโลยี: Python, FastAPI, SQLAlchemy ORM, Alembic migrations, JWT HS256, CORS middleware

จัด API เป็น 3 กลุ่ม:
- Identity & Access: Auth, JWT, role-based access, user approval
- Core Business APIs: Bots, Documents, Chat, LINE Webhook, Live Chat
- Operational APIs: Dashboard, Notifications, Audit Logs

ข้อมูลสำคัญ:
- Role มี admin, support, user
- ผู้ใช้ใหม่ default เป็นรออนุมัติ
- API ตรวจสถานะ account ที่ active ใน endpoint ที่ต้องยืนยันตัวตน
- Chat API ตรวจสิทธิ์ เรียก RAG บันทึก conversation และจัดการ handoff state

แสดง FastAPI เป็นชั้นกลางที่เชื่อมกับ PostgreSQL และ RAG service

## Slide 6 — Database

หัวข้อ: Data Model

สร้าง ER diagram แบบอ่านง่าย โดยใช้ `bots` เป็น entity กลาง

Entities:
- users: account, role, approval, active status, bot quota
- bots: bot configuration, status, system prompt, channel settings, owner
- documents: filename, path, category, owner
- bot_documents: many-to-many relation ระหว่าง bot และ document
- conversations: question, answer, channel, answer/resolution status
- live_sessions: handoff session, mode, active status
- live_messages: customer/bot/staff message
- notifications
- password_reset_tokens
- audit_logs

Relationships:
- User 1-to-many Bot
- User 1-to-many Document
- Bot many-to-many Document ผ่าน bot_documents
- Bot 1-to-many Conversation
- Bot 1-to-many LiveSession
- LiveSession 1-to-many LiveMessage

แสดงเฉพาะ primary key, foreign key และฟิลด์สำคัญ อย่าแสดง secret หรือ password hash

## Slide 7 — AI / RAG Pipeline

หัวข้อ: RAG Pipeline

สร้าง process diagram แบบ 2 ส่วน

ส่วนที่ 1 Knowledge ingestion:
Upload PDF, DOCX, TXT, CSV
→ Load document
→ Split into chunks
→ BAAI/bge-m3 embedding
→ ChromaDB vector index แยกตาม bot

ส่วนที่ 2 Question answering:
User question + recent conversation context
→ similarity search in ChromaDB
→ relevant document chunks
→ prompt assembly
→ Ollama model
→ answer + source filename/snippet หรือ human handoff

ข้อมูลกำกับ:
- จำกัดไฟล์อัปโหลด 10 MB
- chunk size 1,000 และ overlap 200
- TOP_K = 5
- Ollama default model ใน Docker Compose คือ qwen2.5:1.5b
- ส่ง sources กลับมาได้สูงสุด 3 แหล่ง
- ถ้า retrieval หรือ LLM ใช้งานไม่ได้ ระบบแยก service failure จากคำตอบปกติ

## Slide 8 — Live Chat และ LINE Integration

หัวข้อ: Human Handoff และ LINE Integration

สร้าง sequence diagram แสดง:

LINE user
→ LINE Platform
→ POST `/api/line/webhook/{bot_id}`
→ verify `X-Line-Signature`
→ create/find LiveSession และบันทึก LiveMessage
→ RAG
→ LINE reply/push message

เส้นทาง handoff:
- หากผู้ใช้ขอเจ้าหน้าที่ หรือ RAG ไม่พบคำตอบบน LINE
- สถานะเปลี่ยน `bot → waiting`
- ระบบแจ้งเจ้าหน้าที่
- เจ้าหน้าที่ตอบครั้งแรก `waiting → human`
- เมื่อจบ session กลับสู่ bot และปิด active session

สำหรับ web chat: เมื่อไม่พบคำตอบ ระบบแสดงตัวเลือกให้ผู้ใช้กดติดต่อเจ้าหน้าที่

## Slide 9 — Security, Deployment และ Operations

หัวข้อ: Deployment และการควบคุมการเข้าถึง

ใช้ diagram ที่แสดง:

Internet
→ Cloudflare Tunnel
→ frontend:80
→ Nginx
→ API:8000
→ PostgreSQL / uploads volume / vector DB volume
→ Ollama service

Security and operations controls ที่มี:
- JWT HS256
- role-based access control: admin, support, user
- user approval และ active/inactive state
- CORS allowlist ผ่าน `CORS_ORIGINS`
- environment variables สำหรับ secrets และ credentials
- HTTPS ผ่าน Cloudflare Tunnel สำหรับ public deployment
- audit logs สำหรับการจัดการผู้ใช้
- password reset token มี hash, expiry และ used timestamp

ระบุด้วยข้อความสั้น: `ตั้ง DEBUG=false, ใช้ secret ใหม่, จำกัด CORS ให้ตรง domain, ตั้ง SMTP และรัน smoke test ก่อนเปิด pilot`

## Slide 10 — IT Pilot Readiness

หัวข้อ: สิ่งที่ฝ่าย IT ต้องเตรียมสำหรับ Pilot

สรุปเป็น 6 ประเด็น:
- Infrastructure: เครื่องหรือ environment สำหรับ Docker, PostgreSQL และ Ollama
- Network: domain, HTTPS, Cloudflare Tunnel หรือ internal VPN
- Security configuration: SECRET_KEY, database password, admin password, CORS
- Identity and operations: admin account, support account, ขั้นตอนอนุมัติ user
- Knowledge governance: เลือกเอกสารฉบับควบคุมเวอร์ชัน และเจ้าของเอกสาร
- Validation: ทดสอบ RAG, LINE webhook, password reset, handoff และ smoke test

ปิดท้ายด้วยข้อความ: `ScopeBot พร้อมให้ฝ่าย IT ประเมินและกำหนดขอบเขต pilot ตามสภาพแวดล้อมของบริษัท`

ตลอดทั้งงาน ให้ใช้หัวข้อภาษาไทยตรงไปตรงมา ไม่ใช้ข้อความเชิงโฆษณา และทำให้ทุก diagram เข้าใจได้แม้ผู้อ่านไม่เห็นโค้ด

---

หลัง Gamma สร้างร่างแรก ให้ตรวจให้ครบว่า slide 3, 6, 7 และ 8 มี diagram ตามรายละเอียดข้างต้น และไม่มีข้ออ้างด้านความปลอดภัยหรือประสิทธิภาพที่ไม่ได้ระบุใน prompt
