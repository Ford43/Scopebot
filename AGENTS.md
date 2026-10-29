# Scopebot

แพลตฟอร์ม chatbot องค์กร: React/TypeScript + Vite + Tailwind, FastAPI + SQLAlchemy, Ollama และ RAG (Chroma/Qdrant)

## จุดเริ่มต้น
- `src/app/`: หน้าเว็บ, components, hooks, contexts และ types; ใช้ `src/app/lib/api.ts` สำหรับ API และ authentication ตามรูปแบบเดิม
- `api/`: backend; `api/routers/` สำหรับ endpoints, `api/models.py` สำหรับฐานข้อมูล, `api/schemas.py` สำหรับ request/response
- `rag/`: โหลดเอกสาร แบ่งข้อความ ค้นหา และสร้างคำตอบ; `config.py` เก็บการตั้งค่า
- `migrations/`: Alembic; `test/`: regression tests; `deploy/DEPLOY.md`: วิธี deploy
- งาน retrieval/grounding ให้อ่าน `docs/semantic-search.md` และ `docs/rag-correctness.md` ตามส่วนที่เกี่ยวข้อง

## รันจากโฟลเดอร์หลัก (PowerShell)
- ใช้ Python ใน `.venv` เป็นหลัก ไม่สลับกับ `venv` หรือ Python ของระบบ
- Backend: `.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000`
- Frontend: `npm run dev` (พอร์ต 5173; `/api` proxy ไป backend พอร์ต 8000)
- Dependencies: `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` และ `npm install` เมื่อจำเป็น
- ตัวแปรแวดล้อมดูจาก `.env.example`; บริการฐานข้อมูล, Ollama และ vector store ต้องตรงกับการตั้งค่าของงาน

## ตรวจงานตามส่วนที่เปลี่ยน
- Backend: `.\.venv\Scripts\python.exe -m unittest test.test_review_fixes test.test_admin_platform test.test_library_delete`
- รัน test module ที่เกี่ยวข้องเพิ่มเติม เช่น `.\.venv\Scripts\python.exe -m unittest test.test_rag_correctness`
- Frontend: `node test/run_frontend.mjs` และ `npm run build`
- ไม่มี npm script สำหรับ lint/test; อย่าสมมติว่ามี `npm test` หรือ `npm run lint`
- `test/test_rag.py` เป็นการลอง RAG จริง ต้องมีบริการและข้อมูลพร้อม; แยกจาก regression tests ที่ mock โมเดล
- เพิ่ม regression test เมื่อแก้พฤติกรรมหรือบั๊กที่มีนัยสำคัญ; งานเอกสารอย่างเดียวให้ตรวจเนื้อหาและคำสั่งอ้างอิง

## แนวทางทำงาน
- ตอบภาษาไทย กระชับ; สรุปสิ่งที่แก้ ผลตรวจ และข้อจำกัด โดยไม่อ้างว่าทดสอบผ่านถ้ายังไม่ได้รัน
- เริ่มค้นหาเฉพาะไฟล์ที่เกี่ยวข้อง แล้วขยายเมื่อจำเป็น; ข้าม dependencies, ไฟล์ build และข้อมูล runtime เว้นแต่งานต้องใช้
- แก้เท่าที่จำเป็นตามคำขอ ใช้รูปแบบและ components เดิม; ไม่เพิ่ม dependency หรือ refactor นอกขอบเขตโดยไม่มีเหตุผล
- ตรวจ `git status` ก่อนแก้ และรักษาการแก้ไขเดิมกับไฟล์ที่ยังไม่ติดตามของผู้ใช้
- รักษาสิทธิ์ผู้ใช้และการแยกข้อมูลแต่ละบอท; เมื่อเปลี่ยน API ให้ตรวจ schemas และ frontend types ที่เกี่ยวข้อง
- คำตอบ RAG ต้องมีหลักฐานจากเอกสารและ citation ที่ตรงกัน; คำตอบก่อนหน้าของบอทไม่ใช่ข้อเท็จจริงจากเอกสาร
- เปลี่ยนโครงสร้างฐานข้อมูลให้ใช้ Alembic; อย่ารัน migration, ingest หรือสร้างบัญชีกับข้อมูลจริงโดยไม่ตรวจเป้าหมายและขอบเขตคำขอ
- อย่าเปิดเผยหรือ commit ค่าใน `.env`, token หรือรหัสผ่าน; ใช้ไฟล์ `.env*.example` สำหรับตัวอย่าง
- ไม่ลบหรือสร้างใหม่ทับฐานข้อมูล, `data/` หรือ `vector_db/` เพื่อแก้ปัญหาโดยพลการ
