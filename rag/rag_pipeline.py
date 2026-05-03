import ollama
from rag.retriever import retrieve_docs
from config import MODEL_NAME, SYSTEM_PROMPT, DEBUG


def build_context(docs):
    if not docs:
        return ""
    parts = []
    for i, doc in enumerate(docs, 1):
        parts.append(f"[เอกสารที่ {i}]\n{doc.page_content.strip()}")
    return "\n\n".join(parts)


def ask_rag(question: str, bot_id: str) -> str:
    # ดึง docs ที่เกี่ยวข้อง
    docs = retrieve_docs(question, bot_id)

    if not docs:
        return "ไม่พบข้อมูล"

    context = build_context(docs)

    if DEBUG:
        print(f"\n[DEBUG] Question: {question}")
        print(f"[DEBUG] Context:\n {context[:500]}...")

    prompt = f"""ข้อมูลอ้างอิง:
{context}

คำถาม: {question}

คำตอบ:"""

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            options={
                "temperature": 0.0, 
                "top_p": 0.9,
                "repeat_penalty": 1.1,
                "seed": 42,          
                "num_predict": 512,   
            }
        )
        answer = response["message"]["content"].strip()

        if DEBUG:
            print(f"[DEBUG] Answer:\n {answer}")

        return answer if answer else "ไม่พบข้อมูล"

    except Exception as e:
        print(f"❌ LLM error: {e}")
        return "ขออภัย ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง"