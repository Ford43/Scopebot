import os
import re
from typing import Dict, List, Optional, Tuple

import ollama
from rag.evidence import (
    build_retrieval_query,
    parse_grounded_response,
    select_evidence_units,
    extract_shift_start_answer,
    extract_section_answer,
    extract_relevant_quote,
    split_evidence_units,
    units_for_evidence_quotes,
    validate_grounded_answer,
)
from rag.retriever import retrieve_docs
from config import MODEL_NAME, SYSTEM_PROMPT, DEBUG

RAG_ERROR_MESSAGE = "ขออภัย ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง"


class RagUnavailableError(RuntimeError):
    """Retrieval/model failure, distinct from a valid answer or no match."""

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
        page = doc.metadata.get("page")
        page = page if type(page) is int and page > 0 else None
        key = (filename, page)
        if key in seen:
            continue
        seen.add(key)
        snippet = (doc.page_content or "").strip().replace("\n", " ")
        if len(snippet) > 140:
            snippet = snippet[:140] + "…"
        source = {"filename": filename, "snippet": snippet}
        if page is not None:
            source["page"] = page
        sources.append(source)
        if len(sources) >= limit:
            break
    return sources


def _reject_grounding(reason: str, bot_id: str, question: str) -> Tuple[str, List]:
    print(f"[RAG_GROUNDING] reject reason={reason} bot_id={bot_id}")
    if DEBUG:
        print(f"[RAG_GROUNDING] rejected_question={question}")
    return "REQUIRE_HUMAN_HANDOFF", []


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
    history = (history or [])[-6:]
    retrieval_query = build_retrieval_query(question, history)
    try:
        docs = retrieve_docs(retrieval_query, bot_id, history=history, original_question=question)
    except Exception as exc:
        raise RagUnavailableError("Knowledge retrieval failed") from exc

    if not docs:
        return "REQUIRE_HUMAN_HANDOFF", []

    evidence_units = split_evidence_units(docs)
    resolved_question = next((d.metadata.get("resolved_question") for d in docs if d.metadata.get("resolved_question")), question)
    retrieval_query = resolved_question if any(d.metadata.get("resolved_question") for d in docs) else retrieval_query
    selected_units = select_evidence_units(retrieval_query, evidence_units)
    if not selected_units:
        return _reject_grounding("weak_topic_match", bot_id, question)
    if any(unit.metadata.get("section_incomplete") for unit in selected_units):
        return _reject_grounding("section_too_large", bot_id, question)

    context = build_context(selected_units)
    structured = extract_section_answer(question, selected_units)
    if structured is None and any(word in question for word in ('กะ','เข้างาน','เริ่มงาน','กี่โมง')):
        structured = extract_shift_start_answer(resolved_question, selected_units)
    if structured is not None:
        valid, _ = validate_grounded_answer(retrieval_query, structured.answer, structured.evidence, selected_units)
        if valid:
            accepted = units_for_evidence_quotes(structured.evidence, selected_units)
            return structured.answer, extract_sources(accepted)

    # กันเคส: ดึงเอกสาร "จันทร์-ศุกร์" แล้ว LLM มั่วว่าพรุ่งนี้อะไร
    if _calendar_context_mismatch(question, context):
        if DEBUG:
            print(f"[DEBUG] Calendar mismatch — skip LLM for: {question}")
        return _reject_grounding("weak_topic_match", bot_id, question)

    if DEBUG:
        print(f"\n[DEBUG] Question: {question}")
        print(f"[DEBUG] Context:\n {context[:500]}...")

    prompt = f"""ข้อมูลอ้างอิงที่ผ่านการคัดกรอง:
{context}

คำถาม: {question}
คำถามที่ระบุหัวข้อจากบริบท: {resolved_question}

คำสั่ง:
- ตอบจากข้อมูลอ้างอิงด้านบนเท่านั้น ห้ามเดาหรือใช้ความรู้ภายนอก
- ส่ง JSON object เท่านั้น ห้ามใส่ markdown หรือข้อความอื่น
- รูปแบบต้องเป็น {{"answer":"คำตอบ", "evidence_ids":[1]}}
- evidence_ids คือหมายเลข [เอกสารที่ ...] ที่รองรับคำตอบ เลือกได้หลายหมายเลข ห้ามสร้างหมายเลขใหม่
- ถ้าไม่มีหลักฐานที่ตอบคำถามโดยตรง ให้ใช้ answer เป็น "ไม่พบข้อมูล" และ evidence_ids เป็น []
- ห้ามเปลี่ยนตัวเลข ราคา เวลา วัน วันที่ เปอร์เซ็นต์ ชื่อ หรือรหัสจากหลักฐาน
- ใช้ข้อความจากหลักฐานโดยตรง คงคำปฏิเสธและเงื่อนไขทั้งหมด ห้ามย้ายค่าของรายการหนึ่งไปใช้อีกชื่อหนึ่ง
- หากย่อแล้วทำให้เงื่อนไขไม่ครบ ให้คัดข้อความเต็มของรายการนั้นแทน
- ถ้าคำถามถามภาพรวม/ระเบียบ/รายการ ให้ใส่หลักฐานทุกส่วนที่นำมาใช้ตอบ
"""

    final_system_prompt = SYSTEM_PROMPT
    if user_system_prompt and user_system_prompt.strip() != "":
        final_system_prompt += (
            "\n\nคำสั่งเพิ่มเติมเกี่ยวกับบทบาทและพฤติกรรมของคุณ:\n"
            f"{user_system_prompt}"
        )

    messages = [{"role": "system", "content": final_system_prompt}]

    prior_questions = [
        (turn.get("question") or "").strip()
        for turn in history or []
        if (turn.get("question") or "").strip()
    ]
    if prior_questions:
        messages.append({
            "role": "system",
            "content": (
                "คำถามก่อนหน้าใช้เพื่อระบุหัวข้อของคำถามต่อเนื่องเท่านั้น "
                "ห้ามถือเป็นข้อมูลจริง:\n" + "\n".join(prior_questions)
            ),
        })

    messages.append({"role": "user", "content": prompt})

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=messages,
            format={"type": "object", "properties": {
                "answer": {"type": "string"},
                "evidence_ids": {"type": "array", "items": {"type": "integer", "enum": list(range(1, len(selected_units) + 1))}}
            }, "required": ["answer", "evidence_ids"], "additionalProperties": False},
            options={
                "temperature": 0.0,
                "top_p": 0.9,
                "repeat_penalty": 1.1,
                "seed": 42,
                # รายการนโยบายยาวๆ ต้องมีพื้นที่พอ ไม่ตัดกลางทาง
                "num_predict": 1024,
            },
        )
        grounded, parse_reason = parse_grounded_response(
            response["message"]["content"], selected_units
        )
        if grounded is None:
            return _reject_grounding(parse_reason or "invalid_model_json", bot_id, question)

        answer = grounded.answer
        if not answer or "ไม่พบข้อมูล" in answer:
            quote = extract_relevant_quote(retrieval_query, selected_units)
            if quote is None:
                return _reject_grounding("model_no_answer", bot_id, question)
            grounded, answer = quote, quote.answer

        valid, validation_reason = validate_grounded_answer(
            retrieval_query,
            answer,
            grounded.evidence,
            selected_units,
        )
        if not valid:
            return _reject_grounding(
                validation_reason or "unsupported_evidence", bot_id, question
            )

        accepted_units = units_for_evidence_quotes(
            grounded.evidence, selected_units
        )
        sources = extract_sources(accepted_units)

        if DEBUG:
            print(f"[DEBUG] System Prompt:\n {final_system_prompt}")
            print(f"[DEBUG] History turns: {len(history or [])}")
            print(f"[DEBUG] Answer:\n {answer}")

        return answer, sources

    except Exception as e:
        print(f"LLM error: {e}")
        raise RagUnavailableError("Language model unavailable") from e
