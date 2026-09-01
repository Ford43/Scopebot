import os
import re
from typing import Dict, List, Optional, Tuple

import ollama
from rag.retriever import retrieve_docs
from config import MODEL_NAME, SYSTEM_PROMPT, DEBUG

# คำถามวัน/ปฏิทินปัจจุบัน — มักไม่มีในเอกสารองค์กร
_CALENDAR_ASK = re.compile(
    r"(พรุ่งนี้\s*วันอะไร|เมื่อวาน\s*วันอะไร|วันนี้\s*วันอะไร|"
    r"พรุ่งนี้เป็นวัน|เมื่อวานเป็นวัน|วันนี้เป็นวัน|"
    r"วันนี้อะไร|พรุ้งนี้อะไร|วันที่เท่าไหร่)",
    re.IGNORECASE,
)


def _calendar_context_mismatch(question: str, context: str) -> bool:
    """True when question asks about a relative day that context never mentions."""
    if not _CALENDAR_ASK.search(question):
        return False
    if "พรุ่งนี้" in question and "พรุ่งนี้" not in context:
        return True
    if "เมื่อวาน" in question and "เมื่อวาน" not in context:
        return True
    if re.search(r"วันนี้\s*วันอะไร|วันนี้เป็นวัน|วันนี้อะไร", question):
        if "วันนี้" not in context and "ปฏิทิน" not in context:
            return True
    return False


def build_context(docs):
    if not docs:
        return ""
    parts = []
    for i, doc in enumerate(docs, 1):
        parts.append(f"[เอกสารที่ {i}]\n{doc.page_content.strip()}")
    return "\n\n".join(parts)


def extract_sources(docs, limit: int = 3) -> List[Dict]:
    sources = []
    seen = set()
    for doc in docs:
        raw = (
            doc.metadata.get("source")
            or doc.metadata.get("filename")
            or "เอกสาร"
        )
        filename = os.path.basename(str(raw))
        if filename in seen:
            continue
        seen.add(filename)
        snippet = (doc.page_content or "").strip().replace("\n", " ")
        if len(snippet) > 140:
            snippet = snippet[:140] + "…"
        sources.append({"filename": filename, "snippet": snippet})
        if len(sources) >= limit:
            break
    return sources


def _clean_llm_answer(answer: str) -> str:
    """ตัดส่วนที่โมเดลวนซ้ำรูปแบบ คำถาม:/คำตอบ: จาก prompt"""
    text = (answer or "").strip()
    if not text:
        return text

    # ตัดตั้งแต่บรรทัด "คำถาม:" ที่โมเดลเขียนซ้ำท้ายคำตอบ
    cut = re.split(r"\n\s*คำถาม\s*:", text, maxsplit=1)
    text = cut[0].strip()

    # ถ้าขึ้นต้นด้วย "คำตอบ:" ให้เหลือเฉพาะเนื้อหา
    text = re.sub(r"^คำตอบ\s*:\s*", "", text).strip()

    # กันกรณีมีคู่ คำตอบ: ซ้ำอีกครั้งในข้อความ
    parts = re.split(r"\n\s*คำตอบ\s*:", text, maxsplit=1)
    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
        # ถ้าสองฝั่งคล้ายกันมาก เหลือฝั่งแรก
        a, b = parts[0].strip(), parts[1].strip()
        if a == b or a in b or b in a:
            text = a

    return text.strip()


def ask_rag(
    question: str,
    bot_id: str,
    user_system_prompt: str = None,
    history: Optional[list] = None,
) -> Tuple[str, List]:
    """
    Returns (answer, sources).
    sources: [{"filename": "...", "snippet": "..."}, ...]
    history: optional prior turns [{"question","answer"}, ...] oldest → newest
    """
    docs = retrieve_docs(question, bot_id)

    if not docs:
        return "REQUIRE_HUMAN_HANDOFF", []

    context = build_context(docs)
    sources = extract_sources(docs)

    # กันเคส: ดึงเอกสาร "จันทร์-ศุกร์" แล้ว LLM มั่วว่าพรุ่งนี้อะไร
    if _calendar_context_mismatch(question, context):
        if DEBUG:
            print(f"[DEBUG] Calendar mismatch — skip LLM for: {question}")
        return "REQUIRE_HUMAN_HANDOFF", []

    if DEBUG:
        print(f"\n[DEBUG] Question: {question}")
        print(f"[DEBUG] Context:\n {context[:500]}...")

    prompt = f"""ข้อมูลอ้างอิง:
{context}

คำถาม: {question}

คำสั่ง: ตอบจากข้อมูลอ้างอิงด้านบนเท่านั้น
- ถ้าข้อมูลอ้างอิงไม่ได้ตอบคำถามนี้โดยตรง ให้ตอบว่า ไม่พบข้อมูล
- ห้ามเดาวัน/วันที่/เวลาปัจจุบันจากตารางเวลาทำงานหรือคำที่คล้ายกันในเอกสาร
- ตอบเป็นข้อความคำตอบอย่างเดียว ห้ามเขียนคำว่า คำถาม: หรือ คำตอบ: และห้ามถามซ้ำ
- ถ้าคำถามถามภาพรวม/ระเบียบ/รายการ และในข้อมูลอ้างอิงมีหลายข้อ ให้ตอบครบทุกข้อที่เกี่ยวข้อง ห้ามสรุปเหลือเพียงบางข้อ

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
                # รายการนโยบายยาวๆ ต้องมีพื้นที่พอ ไม่ตัดกลางทาง
                "num_predict": 1024,
            },
        )
        answer = _clean_llm_answer(response["message"]["content"])

        if DEBUG:
            print(f"[DEBUG] System Prompt:\n {final_system_prompt}")
            print(f"[DEBUG] History turns: {len(history or [])}")
            print(f"[DEBUG] Answer:\n {answer}")

        if not answer or "ไม่พบข้อมูล" in answer:
            return "REQUIRE_HUMAN_HANDOFF", sources

        return answer, sources

    except Exception as e:
        print(f"LLM error: {e}")
        return "ขออภัย ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง", []
