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

    # ถ้าไม่มี docs → ตอบว่าไม่พบข้อมูล (ไม่ใช่ REQUIRE_HUMAN_HANDOFF)
    if not docs:
        return "ไม่พบข้อมูล"

    context = build_context(docs)

    if DEBUG:
        print(f"\n[DEBUG] Question: {question}")
        print(f"[DEBUG] Context:\n{context[:500]}...")

    prompt = f"""อ่าน context ด้านล่างนี้อย่างละเอียด แล้วตอบคำถามโดยใช้ข้อมูลจาก context เท่านั้น

=== context ===
{context}
=== จบ context ===

คำถาม: {question}

คำแนะนำ: ถ้า context มีการระบุลำดับหรือรายการ ให้ตอบตามลำดับนั้นเลย อย่าสลับหรือเพิ่มเติม

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
                "top_p": 0.8,
                "repeat_penalty": 1.1,
                "seed": 42,
                "num_predict": 512,
            }
        )
        answer = response["message"]["content"].strip()

        if DEBUG:
            print(f"[DEBUG] Answer:\n{answer}")

        # ถ้า LLM ตอบว่าไม่รู้ในรูปแบบต่างๆ → normalize เป็น "ไม่พบข้อมูล"
        no_answer_phrases = [
            "ไม่พบข้อมูล", "ไม่มีข้อมูล", "ไม่ทราบ",
            "not found", "no information", "i don't know"
        ]
        if any(phrase in answer.lower() for phrase in no_answer_phrases):
            return "ไม่พบข้อมูล"

        return answer if answer else "ไม่พบข้อมูล"

    except Exception as e:
        print(f"❌ LLM error: {e}")
        return "ขออภัย ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง"