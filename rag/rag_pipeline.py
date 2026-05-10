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

# 1. เพิ่มพารามิเตอร์ user_system_prompt ในวงเล็บ
def ask_rag(question: str, bot_id: str, user_system_prompt: str = None) -> str:
    # ดึง docs ที่เกี่ยวข้อง
    docs = retrieve_docs(question, bot_id)

    # 🟢 แก้ไขจุดที่ 1: ถ้าไม่พบเอกสารเลย ให้ส่ง Signal โอนสาย
    if not docs:
        return "REQUIRE_HUMAN_HANDOFF"

    context = build_context(docs)

    if DEBUG:
        print(f"\n[DEBUG] Question: {question}")
        print(f"[DEBUG] Context:\n {context[:500]}...")

    prompt = f"""ข้อมูลอ้างอิง:
{context}

คำถาม: {question}

คำตอบ:"""

    # 2. สร้าง Hybrid Prompt ตรงนี้
    final_system_prompt = SYSTEM_PROMPT
    if user_system_prompt and user_system_prompt.strip() != "":
        final_system_prompt += f"\n\nคำสั่งเพิ่มเติมเกี่ยวกับบทบาทและพฤติกรรมของคุณ:\n{user_system_prompt}"

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=[
                # 3. เปลี่ยนจาก SYSTEM_PROMPT เป็น final_system_prompt
                {"role": "system", "content": final_system_prompt},
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
            print(f"[DEBUG] System Prompt:\n {final_system_prompt}") # ลองปริ้นท์ดูเพื่อความชัวร์
            print(f"[DEBUG] Answer:\n {answer}")

        # 🟢 แก้ไขจุดที่ 2: ตรวจสอบคำตอบของ LLM ว่าตอบไม่ได้หรือไม่
        if not answer or "ไม่พบข้อมูล" in answer:
            return "REQUIRE_HUMAN_HANDOFF"

        return answer

    except Exception as e:
        print(f"LLM error: {e}")
        return "ขออภัย ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง"