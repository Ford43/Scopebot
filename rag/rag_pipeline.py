from typing import Optional

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


def ask_rag(
    question: str,
    bot_id: str,
    user_system_prompt: str = None,
    history: Optional[list] = None,
) -> str:
    """
    history: optional list of prior turns
    [{"question": "...", "answer": "..."}, ...] oldest → newest
    """
    docs = retrieve_docs(question, bot_id)

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

    final_system_prompt = SYSTEM_PROMPT
    if user_system_prompt and user_system_prompt.strip() != "":
        final_system_prompt += (
            "\n\nคำสั่งเพิ่มเติมเกี่ยวกับบทบาทและพฤติกรรมของคุณ:\n"
            f"{user_system_prompt}"
        )

    messages = [{"role": "system", "content": final_system_prompt}]

    for turn in history or []:
        q = (turn.get("question") or "").strip()
        a = (turn.get("answer") or "").strip()
        if q:
            messages.append({"role": "user", "content": q})
        if a:
            messages.append({"role": "assistant", "content": a})

    messages.append({"role": "user", "content": prompt})

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=messages,
            options={
                "temperature": 0.0,
                "top_p": 0.9,
                "repeat_penalty": 1.1,
                "seed": 42,
                "num_predict": 512,
            },
        )
        answer = response["message"]["content"].strip()

        if DEBUG:
            print(f"[DEBUG] System Prompt:\n {final_system_prompt}")
            print(f"[DEBUG] History turns: {len(history or [])}")
            print(f"[DEBUG] Answer:\n {answer}")

        if not answer or "ไม่พบข้อมูล" in answer:
            return "REQUIRE_HUMAN_HANDOFF"

        return answer

    except Exception as e:
        print(f"LLM error: {e}")
        return "ขออภัย ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง"
