import sys
import os
import shutil
import gc
import chromadb # เพิ่ม chromadb เพื่อเข้าถึงคำสั่งเคลียร์แคช

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from config import EMBEDDING_MODEL
from rag.document_loader import load_documents
from rag.chunker import split_documents

from langchain_huggingface import HuggingFaceEmbeddings

try:
    from langchain_chroma import Chroma
except:
    from langchain_community.vectorstores import Chroma


def ingest(bot_id) -> bool:
    """Ingest documents for a bot. Returns True only when chunks were written."""
    print(f"Ingest for bot: {bot_id}")

    embedding = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    persist_path = f"vector_db/{bot_id}"

    if os.path.exists(persist_path):
        print("Clearing old DB...")
        
        # --- [เพิ่มโค้ดส่วนนี้เพื่อปลดล็อคไฟล์] ---
        try:
            # สั่งเคลียร์การเชื่อมต่อที่ค้างอยู่ใน ChromaDB
            chromadb.api.client.SharedSystemClient.clear_system_cache()
        except Exception:
            pass
            
        gc.collect() # บังคับให้ระบบคืนค่า Memory และ File Handles
        
        # ใช้ ignore_errors=True ช่วยข้ามไฟล์ที่ลบไม่ได้ชั่วคราว
        shutil.rmtree(persist_path, ignore_errors=True)

    print("Loading documents...")
    docs = load_documents(bot_id)

    # guard — ถ้าไม่มีเอกสารให้หยุดเลย
    if not docs:
        print(f"[ingest] no documents for bot: {bot_id} (check data/{bot_id}/)")
        return False

    print("Splitting documents...")
    chunks = split_documents(docs)

    # guard — ถ้าไม่มี chunks ให้หยุดเลย
    if not chunks:
        print(f"ไม่มี chunks สำหรับ bot: {bot_id} — ข้ามการบันทึก DB")
        return False

    for chunk in chunks:
        chunk.metadata["bot_id"] = bot_id

    print("Creating embeddings & saving to DB...")
    Chroma.from_documents(
        documents=chunks,
        embedding=embedding,
        persist_directory=persist_path
    )

    print(f"Ingestion complete for {bot_id}!")
    return True

if __name__ == "__main__":
    print("INGEST START")

    bot_id = sys.argv[1] if len(sys.argv) > 1 else "bot_nt"

    ingest(bot_id)