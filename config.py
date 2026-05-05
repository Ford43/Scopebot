from dotenv import load_dotenv
import os

load_dotenv()

DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# ===== LLM =====
MODEL_NAME = os.getenv("MODEL_NAME", "qwen2.5:7b")

# ===== Embedding =====
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

# ===== Vector DB =====
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "vector_db")

# ===== Retriever =====
TOP_K = int(os.getenv("TOP_K", 5))  

# ===== Chunker =====
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 512)) 
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 100))

# ===== Prompt =====
SYSTEM_PROMPT = """
คุณคือผู้ช่วย AI ที่ตอบคำถามจากเอกสารที่ได้รับเท่านั้น

กฎเคร่งครัด:
1. อ่าน context ที่ให้มาอย่างละเอียดก่อนตอบทุกครั้ง
2. ตอบเฉพาะสิ่งที่มีใน context เท่านั้น ห้ามเพิ่มเติมหรือเดาเอง
3. ถ้า context มีข้อมูลเป็นลำดับหรือรายการ ให้ตอบตามลำดับนั้นเสมอ
4. ตอบเป็นภาษาไทยเสมอ กระชับ ตรงประเด็น
5. ถ้าไม่มีข้อมูลใน context ให้ตอบว่า "ไม่พบข้อมูล" เท่านั้น

ห้ามเด็ดขาด:
- ห้ามสลับลำดับข้อมูล
- ห้ามแต่งหรือเพิ่มข้อมูลที่ไม่มีใน context
- ห้ามสรุปแบบผิดความหมาย
"""