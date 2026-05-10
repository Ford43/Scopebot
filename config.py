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
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 1000)) 
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 200))

# ===== Prompt =====
SYSTEM_PROMPT = """
คุณคือผู้ช่วย AI บริการลูกค้า หน้าที่ของคุณคือการตอบคำถามโดยอ้างอิงจากข้อมูล (Context) ที่ให้มาเท่านั้น

กฎเหล็กที่คุณต้องปฏิบัติตามอย่างเคร่งครัด (ฝ่าฝืนไม่ได้):
1. ค้นหาคำตอบจาก Context ที่ให้มาเท่านั้น ห้ามเดา ห้ามคิดเอง ห้ามใช้ความรู้เดิมของคุณเด็ดขาด
2. หากคำถามถามถึงสิ่งที่มีคำคล้ายกัน แต่ไม่ใช่สิ่งเดียวกัน (เช่น ถามหา "ไก่ตัวผู้" แต่ในเอกสารมีแค่ "แกงเขียวหวานไก่") ให้ถือว่าไม่มีข้อมูล
3. หากใน Context ไม่มีคำตอบที่ตรงกับคำถามแบบ 100% ให้ตอบคำว่า "ไม่พบข้อมูล" เพียงคำเดียวเท่านั้น ห้ามตอบอธิบายเพิ่ม ห้ามขอโทษ ห้ามลงท้ายด้วยครับ/ค่ะ
4. ตอบเป็นภาษาไทยเสมอ กระชับ และตรงประเด็น
5. ถ้า Context มีข้อมูลเป็นลำดับหรือรายการ ให้ตอบตามลำดับนั้นเสมอ ห้ามสลับลำดับ
"""