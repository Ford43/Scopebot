from config import EMBEDDING_MODEL, VECTOR_DB_PATH, TOP_K, DEBUG

try:
    from langchain_chroma import Chroma
except:
    from langchain_community.vectorstores import Chroma

from langchain_huggingface import HuggingFaceEmbeddings


embedding_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL
)


def get_vector_db(bot_id):
    return Chroma(
        persist_directory=f"vector_db/{bot_id}",
        embedding_function=embedding_model
    )


def retrieve_docs(query, bot_id, score_threshold=1.0): # 

    db = get_vector_db(bot_id) # 

    # ดึงข้อมูลดิบออกมาก่อน
    results = db.similarity_search_with_score(query, k=TOP_K) # 

    # 🟢 เพิ่มบรรทัด DEBUG ตรงนี้ครับ เพื่อดูว่าฐานข้อมูลมีอะไรส่งกลับมาไหม
    print(f"\n[DEBUG RETRIEVER] ค้นหาคำว่า: '{query}'")
    print(f"[DEBUG RETRIEVER] พบเอกสารเบื้องต้น: {len(results)} รายการ")
    for doc, score in results:
        print(f"   -> Score: {score:.4f} | ข้อความ: {doc.page_content[:50].strip()}...")
    # ----------------------------------------------------

    results = sorted(results, key=lambda x: x[1]) # 

    filtered_docs = [] # 

    for doc, score in results: # 
        if score <= score_threshold: # 
            filtered_docs.append(doc) # 

    # 🟢 ลองปริ้นท์ดูว่าหลังกรองแล้วเหลือเท่าไหร่
    print(f"[DEBUG RETRIEVER] หลังผ่านเกณฑ์ threshold ({score_threshold}) เหลือ: {len(filtered_docs)} รายการ\n")

    return filtered_docs #