import ollama
from rag.retriever import retrieve_docs
from config import MODEL_NAME, SYSTEM_PROMPT, DEBUG

def build_context(docs):
    # (ฟังก์ชันเดิม ไม่ต้องแก้)
    if not docs:
        return ""
    parts = []
    for i, doc in enumerate(docs, 1):
        parts.append(f"[เอกสารที่ {i}]\n{doc.page_content.strip()}")
    return "\n\n".join(parts)

# 🟢 1. เพิ่ม return_context: bool = False
def ask_rag(question: str, bot_id: str, user_system_prompt: str = None, return_context: bool = False): 
    docs = retrieve_docs(question, bot_id)

    if not docs:
        # 🟢 2. ปรับการ Return ตาม Flag
        if return_context:
            return {"answer": "REQUIRE_HUMAN_HANDOFF", "context": ""}
        return "REQUIRE_HUMAN_HANDOFF"

    context = build_context(docs)

    if DEBUG:
        print(f"\n[DEBUG] Question: {question}")
        print(f"[DEBUG] Context:\n {context[:500]}...")

    prompt = f"""ข้อมูลอ้างอิง:
{context}

คำถาม: {question}

คำตอบ:"""

    final_system_prompt = SYSTEM_PROMPT
    if user_system_prompt and user_system_prompt.strip() != "":
        final_system_prompt += f"\n\nคำสั่งเพิ่มเติมเกี่ยวกับบทบาทและพฤติกรรมของคุณ:\n{user_system_prompt}"

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=[
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

        if not answer or "ไม่พบข้อมูล" in answer:
            # 🟢 3. ปรับการ Return ตาม Flag
            if return_context:
                return {"answer": "REQUIRE_HUMAN_HANDOFF", "context": context}
            return "REQUIRE_HUMAN_HANDOFF"

        # 🟢 4. คืนค่าเป็น Dictionary เมื่อต้องการประเมินผล
        if return_context:
            return {"answer": answer, "context": context}
            
        return answer

    except Exception as e:
        print(f"LLM error: {e}")
        error_msg = "ขออภัย ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง"
        if return_context:
            return {"answer": error_msg, "context": ""}
        return error_msg