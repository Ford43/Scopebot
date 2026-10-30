"""Deterministic evidence selection and answer grounding for the RAG pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
import json
import re
import unicodedata
from typing import Iterable, Sequence


MAX_EVIDENCE_CHARS = 450
EVIDENCE_OVERLAP = 60
MAX_SELECTED_EVIDENCE = 8


@dataclass(frozen=True)
class EvidenceUnit:
    text: str
    metadata: dict

    @property
    def page_content(self) -> str:
        """Keep compatibility with LangChain Document consumers."""
        return self.text


@dataclass(frozen=True)
class GroundedAnswer:
    answer: str
    evidence: list[str]


_POLITE_OR_FILLER = (
    "ครับ",
    "ค่ะ",
    "คะ",
    "หน่อย",
    "ขอสอบถาม",
    "สอบถาม",
    "อยากทราบ",
    "ช่วยบอก",
    "please",
)

_ITEM_INTENTS = {
    "price": (
        "ราคาเท่าไหร่",
        "ราคาเท่าไร",
        "กี่บาท",
        "ราคา",
        "ค่าใช้จ่าย",
        "howmuch",
        "price",
    ),
    "duration": (
        "ใช้เวลากี่",
        "ใช้เวลาเท่าไหร่",
        "ใช้เวลาเท่าไร",
        "นานเท่าไหร่",
        "นานไหม",
        "กี่นาที",
        "กี่ชั่วโมง",
        "กี่วัน",
        "howlong",
    ),
    "warranty": (
        "รับประกันกี่",
        "รับประกันนาน",
        "รับประกัน",
        "ประกันกี่",
        "warranty",
    ),
}

_GLOBAL_INTENTS = {
    "hours": {
        "question": ("เปิดปิด", "กี่โมง", "เวลาเปิด", "เวลาปิด", "เวลาทำการ", "openinghours"),
        "evidence": ("เวลาเปิด", "เวลาปิด", "เวลาทำการ", "เปิดบริการ", "จันทร์", "อาทิตย์"),
    },
    "address": {
        "question": ("ที่อยู่", "อยู่ที่ไหน", "อยู่ไหน", "พิกัด", "address", "location"),
        "evidence": ("ที่อยู่", "ถนน", "ตำบล", "อำเภอ", "จังหวัด", "พิกัด"),
    },
    "contact": {
        "question": ("เบอร์โทร", "โทรศัพท์", "ติดต่อ", "ไลน์", "line", "contact"),
        "evidence": ("โทร", "โทรศัพท์", "line", "อีเมล", "email", "ติดต่อ"),
    },
    "payment": {
        "question": ("ชำระเงิน", "จ่ายเงิน", "เงินสด", "โอน", "บัตรเครดิต", "ผ่อน", "payment"),
        "evidence": ("ชำระเงิน", "เงินสด", "โอน", "บัตร", "เช็ค", "ผ่อน", "มัดจำ"),
    },
}

_LIST_QUESTIONS = (
    "มีบริการอะไร",
    "บริการทั้งหมด",
    "รายการบริการ",
    "มีอะไรบ้าง",
    "ทั้งหมดมีอะไร",
    "listservices",
)

_FOLLOWUP_MARKERS = (
    "แล้วราคา",
    "แล้วใช้เวลา",
    "แล้วกี่",
    "อันนี้",
    "เรื่องนี้",
    "รายการนี้",
    "มันราคา",
    "whatdocuments",
    "whatabout",
    "howmuch",
    "howlong",
)

_GENERIC_QUESTION_PARTS = (
    "แล้ว",
    "เท่าไหร่",
    "เท่าไร",
    "ไหม",
    "หรือไม่",
    "อะไร",
    "อย่างไร",
    "แบบไหน",
    "whatdocuments",
    "whatabout",
    "whatis",
    "tellmeabout",
)

_ACTION_MARKERS = (
    "เปลี่ยน",
    "ตรวจ",
    "ซ่อม",
    "ทำสี",
    "ตั้งศูนย์",
    "เติม",
    "ติดตั้ง",
)

_WEEKDAYS = (
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัสบดี",
    "ศุกร์",
    "เสาร์",
    "อาทิตย์",
)

_MONTHS = (
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
)


def normalize_whitespace(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    return " ".join(text.split())


def _compact(text: str) -> str:
    text = normalize_whitespace(text).lower()
    return re.sub(r"[^0-9a-z\u0e00-\u0e7f]+", "", text)


def _is_heading(lines: list[str], index: int, first_content_index: int) -> bool:
    line = lines[index].strip()
    if not line or line.startswith(("-", "*", "•")) or ":" in line:
        return False
    if len(line) > 100 or line.endswith((".", "!", "?")):
        return False
    if re.match(r"^\d+[.)]\s+\S", line):
        next_line = next((item.strip() for item in lines[index + 1:] if item.strip()), "")
        return bool(next_line) and not re.match(r"^\d+[.)]\s+", next_line)
    if index == first_content_index:
        return True
    next_line = next((item.strip() for item in lines[index + 1 :] if item.strip()), "")
    previous_blank = index == 0 or not lines[index - 1].strip()
    return previous_blank and bool(next_line) and (
        next_line.startswith(("-", "*", "•")) or ":" not in next_line
    )


def _split_long_text(text: str, max_chars: int, overlap: int) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []

    pieces: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_chars)
        if end < len(text):
            boundary = max(text.rfind("\n", start, end), text.rfind(" ", start, end))
            if boundary > start + max_chars // 2:
                end = boundary
        pieces.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return [piece for piece in pieces if piece]


def _segment_text(text: str, max_chars: int, overlap: int, initial_heading: str = "", trailing_heading: str = "") -> list[str]:
    lines = (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    first_content_index = next((i for i, line in enumerate(lines) if line.strip()), 0)
    heading = initial_heading
    paragraph: list[str] = []
    units: list[str] = []

    def flush_paragraph() -> None:
        if not paragraph:
            return
        body = " ".join(paragraph).strip()
        paragraph.clear()
        if body:
            units.append(f"{heading}\n{body}" if heading else body)

    for index, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            flush_paragraph()
            continue
        is_heading = _is_heading(lines, index, first_content_index)
        if trailing_heading and line == trailing_heading and not any(item.strip() for item in lines[index + 1:]):
            is_heading = True
        if initial_heading and index == first_content_index and not re.match(r"^\d+[.)]\s+", line):
            next_line = next((item.strip() for item in lines[index + 1:] if item.strip()), "")
            is_heading = is_heading and next_line.startswith(("-", "*", "•"))
        if is_heading:
            flush_paragraph()
            heading = line
            continue
        if line.startswith(("-", "*", "•")) or ":" in line:
            flush_paragraph()
            body = line.lstrip("-*• ").strip()
            units.append(f"{heading}\n{body}" if heading else body)
            continue
        paragraph.append(line)
    flush_paragraph()

    if not units and text.strip():
        units = [text.strip()]

    result: list[str] = []
    for unit in units:
        title, sep, body = unit.partition("\n")
        if sep and len(unit) > max_chars:
            result.extend(title + "\n" + piece for piece in _split_long_text(body, max_chars - len(title) - 1, overlap))
        else:
            result.extend(_split_long_text(unit, max_chars, overlap))
    return result


def split_evidence_units(
    docs: Iterable,
    max_chars: int = MAX_EVIDENCE_CHARS,
    overlap: int = EVIDENCE_OVERLAP,
) -> list[EvidenceUnit]:
    units: list[EvidenceUnit] = []
    page_sections = {}
    source_order = {}
    docs = list(docs)
    for doc_index, doc in enumerate(docs):
        metadata = dict(getattr(doc, "metadata", {}) or {})
        if metadata.get("section") and "evidence_unit" in metadata:
            units.append(EvidenceUnit(text=doc.page_content, metadata=metadata))
            continue
        source = metadata.get("source")
        initial = page_sections.get(source, "") if metadata.get("page") and source else ""
        trailing = ""
        if metadata.get("page") and source and doc_index + 1 < len(docs):
            following = docs[doc_index + 1]
            lines = [line.strip() for line in doc.page_content.splitlines() if line.strip()]
            next_lines = [line.strip() for line in following.page_content.splitlines() if line.strip()]
            if following.metadata.get("source") == source and following.metadata.get("page") and lines and next_lines and re.match(r"^\d+[.)]\s+\S", lines[-1]) and next_lines[0].startswith(("-", "*", "•")):
                trailing = lines[-1]
        for index, text in enumerate(
            _segment_text(getattr(doc, "page_content", ""), max_chars, overlap, initial, trailing)
        ):
            unit_metadata = dict(metadata)
            unit_metadata["evidence_unit"] = index
            first_line = text.split("\n", 1)[0]
            if "\n" in text or re.match(r"^\d+[.)]\s+\S", first_line):
                unit_metadata["section"] = first_line
                unit_metadata.setdefault("unit_order", source_order.get(source, 0))
                if metadata.get("page") and source:
                    page_sections[source] = first_line
            source_order[source] = source_order.get(source, 0) + 1
            units.append(EvidenceUnit(text=text, metadata=unit_metadata))
        if trailing:
            page_sections[source] = trailing
    return units


def _detect_item_intent(question: str) -> str | None:
    compact = _compact(question)
    for intent, phrases in _ITEM_INTENTS.items():
        if any(_compact(phrase) in compact for phrase in phrases):
            return intent
    return None


def _detect_global_intent(question: str) -> str | None:
    compact = _compact(question)
    for intent, config in _GLOBAL_INTENTS.items():
        if any(_compact(phrase) in compact for phrase in config["question"]):
            return intent
    return None


def _subject_from_question(question: str) -> str:
    subject = _compact(question)
    removals = list(_POLITE_OR_FILLER) + list(_GENERIC_QUESTION_PARTS)
    for phrases in _ITEM_INTENTS.values():
        removals.extend(phrases)
    for phrase in sorted({_compact(item) for item in removals}, key=len, reverse=True):
        subject = subject.replace(phrase, "")
    subject = subject.removeprefix("ค่า").removeprefix("บริการ")
    if not _detect_item_intent(question):
        prefixes = "|".join(_compact(w) for w in ("ถ้า", "หาก", "เมื่อ", "การ", "ระเบียบ", "ขอทราบ", "อยากรู้"))
        suffixes = "|".join(_compact(w) for w in ("ต้องทำ", "ต้อง", "มี", "ได้", "บ้าง", "อย่างไร", "ยังไง", "ไหม"))
        subject = re.sub(f"^(?:{prefixes})+", "", subject)
        subject = re.sub(f"(?:{suffixes})+$", "", subject)

    action_positions = [subject.find(marker) for marker in _ACTION_MARKERS if marker in subject]
    if action_positions:
        subject = subject[min(action_positions) :]
    return subject


def _topic_ratio(subject: str, evidence: str) -> float:
    if not subject:
        return 0.0
    evidence_compact = _compact(evidence)
    if subject in evidence_compact:
        return 1.0
    blocks = SequenceMatcher(None, subject, evidence_compact, autojunk=False).get_matching_blocks()
    longest = max((block.size for block in blocks), default=0)
    return longest / len(subject)


def _topic_matches(question: str, evidence: str) -> bool:
    if section_matches(question, evidence.split("\n", 1)[0]):
        return True
    # Staff shift starts are different from shop opening hours. In particular,
    # "กี่โมง" must not route these questions to the opening-hours-only signals.
    question_compact = _compact(question)
    if "กะ" in question_compact and any(word in question_compact for word in ("เข้างาน", "เริ่มงาน", "เวลาเข้ากะ", "เวลาเริ่มกะ")):
        evidence_compact = _compact(evidence)
        requested = re.search(r"กะ(เช้า|บ่าย|เย็น|ดึก|กลางวัน|กลางคืน|พิเศษ)", question_compact)
        if requested and requested.group(0) not in evidence_compact:
            return False
        return (
            "กะ" in evidence_compact
            and any(word in evidence_compact for word in ("เข้างาน", "เริ่มงาน"))
            and bool(re.search(r"\d{1,2}[:.]\d{2}", evidence))
        )
    global_intent = _detect_global_intent(question)
    evidence_compact = _compact(evidence)
    if global_intent:
        signals = _GLOBAL_INTENTS[global_intent]["evidence"]
        return any(_compact(signal) in evidence_compact for signal in signals)

    question_compact = _compact(question)
    if any(_compact(marker) in question_compact for marker in _LIST_QUESTIONS):
        return any(
            signal in evidence_compact
            for signal in ("บริการ", "รายการ", "นโยบาย", "ข้อกำหนด", "สิ่งที่")
        )

    subject = _subject_from_question(question)
    intent = _detect_item_intent(question)
    threshold = 0.82 if intent else 0.55
    ratio = _topic_ratio(subject, evidence)
    if intent not in {"price", "warranty"} and subject:
        blocks = SequenceMatcher(None, subject, evidence_compact, autojunk=False).get_matching_blocks()
        ratio = max(ratio, sum(block.size for block in blocks if block.size >= 3) / len(subject))
    return len(subject) >= 3 and ratio >= threshold


def select_evidence_units(
    question: str,
    units: Sequence[EvidenceUnit],
    limit: int = MAX_SELECTED_EVIDENCE,
) -> list[EvidenceUnit]:
    selected = [unit for unit in units if unit_topic_matches(question, unit)]
    if any(section_matches(question, unit.metadata.get("section", "")) or unit.metadata.get('semantic_section_match') for unit in selected):
        if len(selected) > 80:
            return [EvidenceUnit(u.text, {**u.metadata, "section_incomplete": True}) for u in selected[:80]]
        return selected[:80]
    return selected[:limit]


def unit_topic_matches(question, unit):
    from rag.semantic import semantic_match
    codes = re.findall(r'\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b', question.upper())
    if codes:
        present = set(re.findall(r'\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b', unit.text.upper()))
        families = {code.split('-')[0] for code in codes}
        conflicting = {code for code in present if code.split('-')[0] in families} - set(codes)
        return bool(set(codes) & present) and not conflicting
    requested = re.search(r"กะ(?:เช้า|บ่าย|เย็น|ดึก|กลางวัน|กลางคืน|พิเศษ)", question)
    mentioned = re.findall(r"กะ(?:เช้า|บ่าย|เย็น|ดึก|กลางวัน|กลางคืน|พิเศษ)", unit.text)
    if requested and mentioned and requested.group(0) not in mentioned:
        return False
    if semantic_match(unit.metadata):
        return True
    return _topic_matches(question, unit.text)


def section_matches(question: str, heading: str) -> bool:
    """Match an explicitly requested section, independent of the document domain."""
    if not heading.strip():
        return False
    if not any(word in question for word in ("อะไรบ้าง", "อย่างไร", "ยังไง", "ต้องทำ", "ขั้นตอน", "ระเบียบ", "วิธี")):
        return False
    title = re.sub(r"^(?:\d+[.)]\s*|#{1,6}\s+)", "", heading)
    requested_shift = re.search(r"กะ(?:เช้า|บ่าย|เย็น|ดึก|กลางวัน|กลางคืน|พิเศษ)", question)
    if requested_shift and "กะ" in heading and requested_shift.group(0) not in heading:
        return False
    title = re.sub(r"\([^)]*\)", "", title).strip()
    title = re.sub(r"^การ", "", title)
    key, query = _compact(title), _compact(question)
    start = query.find(key)
    # A Thai leading vowel belongs to the following consonant: ปิด is not
    # a word match inside เปิด, even though its codepoints form a substring.
    return len(key) >= 4 and start >= 0 and (start == 0 or query[start - 1] not in "เแโใไ")


def extract_section_answer(question: str, units: Sequence[EvidenceUnit]) -> GroundedAnswer | None:
    matched = [u for u in units if section_matches(question, u.metadata.get("section", "")) or (
        u.metadata.get('semantic_section_match') and re.match(r'^\d+[.)]\s+', u.metadata.get('section', '')))]
    if not matched:
        return None
    if any(u.metadata.get("section_incomplete") for u in matched):
        return None
    if len({(u.metadata.get("source"), u.metadata["section"]) for u in matched}) != 1:
        return None  # Ambiguous versions/qualifiers must not pick the first hit.
    key = (matched[0].metadata.get("source"), matched[0].metadata["section"])
    matched = [u for u in matched if (u.metadata.get("source"), u.metadata["section"]) == key]
    matched.sort(key=lambda u: u.metadata.get("unit_order", 0))
    bodies = list(dict.fromkeys(u.text.split("\n", 1)[-1].strip() for u in matched))
    return GroundedAnswer(answer="\n".join("- " + body for body in bodies), evidence=[u.text for u in matched])


def extract_relevant_quote(question: str, units: Sequence[EvidenceUnit]) -> GroundedAnswer | None:
    """On model abstention, show one strongly matched original passage as a quote.

    This deliberately does not synthesize a yes/no conclusion or mix passages.
    """
    subject = _subject_from_question(question)
    matched = [u for u in units if len(subject) >= 4 and _topic_ratio(subject, u.text) >= 0.7]
    if len(matched) != 1:
        return None
    text = matched[0].text
    return GroundedAnswer(answer="ข้อมูลจากเอกสาร:\n" + text, evidence=[text])


def extract_shift_start_answer(question: str, units: Sequence[EvidenceUnit]) -> GroundedAnswer | None:
    """Read explicit shift start rows; never infer starts from shop hours."""
    compact = _compact(question)
    if any(word in compact for word in (*_WEEKDAYS, "วันนี้", "พรุ่งนี้", "เมื่อวาน", "ออกงาน", "เลิกงาน", "ปิดร้าน")):
        return None
    if "กะ" not in compact or not any(word in compact for word in ("เข้างาน", "เริ่มงาน", "เวลาเข้ากะ", "เวลาเริ่มกะ")):
        return None
    rows = []
    seen = {}
    requested = re.search(r"กะ(เช้า|บ่าย|เย็น|ดึก|กลางวัน|กลางคืน|พิเศษ)", compact)
    for unit in select_evidence_units(question, units):
        if any(word in unit.text for word in ("วัน", "เฉพาะ", "ยกเว้น", "กรณี", "แทน", "ถ้า", "ตามตาราง")):
            return None
        matches = re.finditer(r"(?:^|[;\n])\s*(กะ(?:เช้า|บ่าย|เย็น|ดึก|กลางวัน|กลางคืน|พิเศษ))\s*[:：]\s*(?:เข้างาน|เริ่มงาน)\s*(\d{1,2}:\d{2})", unit.text)
        for match in matches:
            shift, time = match.groups()
            if requested and shift != requested.group(0):
                continue
            if shift in seen and seen[shift] != time:
                return None
            if shift not in seen:
                rows.append((shift, time, unit.text))
                seen[shift] = time
    if not rows:
        return None
    order = ["กะเช้า", "กะกลางวัน", "กะบ่าย", "กะเย็น", "กะดึก", "กะกลางคืน", "กะพิเศษ"]
    rows.sort(key=lambda row: order.index(row[0]))
    return GroundedAnswer(answer="\n".join(f"{shift}เข้างาน {time} น." for shift, time, _ in rows),
                          evidence=[text for _, _, text in rows])


def is_followup_question(question: str) -> bool:
    compact = _compact(question)
    if any(_compact(marker) in compact for marker in _FOLLOWUP_MARKERS):
        return True
    return bool(_detect_item_intent(question) and len(_subject_from_question(question)) < 3)


def build_retrieval_query(question: str, history: Sequence[dict] | None) -> str:
    question = (question or "").strip()
    if not question or not history or not is_followup_question(question):
        return question
    previous = (history[-1].get("question") or "").strip()
    return f"{previous}\n{question}" if previous else question


def parse_grounded_response(raw: str, units: Sequence[EvidenceUnit] | None = None) -> tuple[GroundedAnswer | None, str | None]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        payload = json.loads(text)
    except (TypeError, json.JSONDecodeError):
        return None, "invalid_model_json"
    if not isinstance(payload, dict):
        return None, "invalid_model_json"
    answer = payload.get("answer")
    evidence = payload.get("evidence")
    if answer == "ไม่พบข้อมูล" and (payload.get("evidence_ids") == [] or evidence == []):
        return GroundedAnswer(answer=answer, evidence=[]), None
    if "evidence_ids" in payload:
        ids = payload["evidence_ids"]
        if units is None or not isinstance(ids, list) or not ids or any(type(i) is not int or i < 1 or i > len(units) for i in ids):
            return None, "unsupported_evidence"
        evidence = [units[i - 1].text for i in dict.fromkeys(ids)]
    if not isinstance(answer, str) or not answer.strip():
        return None, "invalid_model_json"
    if not isinstance(evidence, list) or not evidence or not all(
        isinstance(item, str) and item.strip() for item in evidence
    ):
        return None, "invalid_model_json"
    return GroundedAnswer(answer=answer.strip(), evidence=[item.strip() for item in evidence]), None


def _canonical_number(token: str) -> str:
    return token.replace(",", "").lstrip("0") or "0"


def _factual_tokens(text: str) -> set[str]:
    normalized = unicodedata.normalize("NFKC", text or "")
    tokens = {f"number:{_canonical_number(item)}" for item in re.findall(r"\d[\d,]*(?:\.\d+)?", normalized)}
    compact = _compact(normalized)
    tokens.update(f"weekday:{day}" for day in _WEEKDAYS if day in compact)
    tokens.update(f"month:{month}" for month in _MONTHS if month in compact)
    for code in re.findall(r"\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b", normalized.upper()):
        tokens.add(f"code:{code}")
    return tokens


def validate_grounded_answer(
    question: str,
    answer: str,
    evidence_quotes: Sequence[str],
    selected_units: Sequence[EvidenceUnit],
) -> tuple[bool, str | None]:
    if not answer.strip() or not evidence_quotes or not selected_units:
        return False, "unsupported_evidence"
    unit_texts = [normalize_whitespace(unit.text) for unit in selected_units]
    for quote in evidence_quotes:
        normalized_quote = normalize_whitespace(quote)
        if not any(normalized_quote in unit_text for unit_text in unit_texts):
            return False, "unsupported_evidence"
        if not any(unit_topic_matches(question, unit) for unit in selected_units
                   if normalized_quote in normalize_whitespace(unit.text)):
            return False, "weak_topic_match"

    supported_facts = _factual_tokens("\n".join(evidence_quotes))
    if not _factual_tokens(answer).issubset(supported_facts):
        return False, "unsupported_fact"
    # Retrieval relevance is not entailment. Only accept literal supported
    # assertions (or the deterministic shift formatter), never a bag of facts.
    shift = extract_shift_start_answer(question, selected_units)
    if shift is not None and answer == shift.answer and set(shift.evidence).issubset(evidence_quotes):
        return True, None
    cited_texts = [unit.text for unit in selected_units if any(
        normalize_whitespace(quote) in normalize_whitespace(unit.text) for quote in evidence_quotes)]
    if not _literal_answer_supported(answer, evidence_quotes) or not _literal_answer_supported(answer, cited_texts):
        return False, "unsupported_claim"
    return True, None


def _literal_answer_supported(answer: str, quotes: Sequence[str]) -> bool:
    def clean(text):
        text = re.sub(r"^\s*[-*•]\s*", "", text.strip())
        return normalize_whitespace(text).replace("：", ":").casefold()

    guards = ("ไม่", "ห้าม", "งด", "เฉพาะ", "ยกเว้น", "กรณี", "ถ้า", "เมื่อ", "เท่านั้น",
              "not ", "never ", "only ", "unless ", "except ", "if ")
    normalized_answer = clean(answer)
    # A restriction can live on the heading or the preceding line. Comparing
    # counts also prevents a second "ไม่" from masking a deleted negation.
    if any(clean(quote).count(word) > normalized_answer.count(word)
           for quote in quotes for word in guards):
        return False
    lines = [clean(line) for line in answer.splitlines() if line.strip()]
    if lines and lines[0] == "ข้อมูลจากเอกสาร:":
        lines.pop(0)
    for line in lines:
        supported = False
        for quote in quotes:
            for raw in quote.splitlines():
                source = clean(raw)
                if line == source:
                    supported = True
                    break
                # Keep restrictions even when quoting only part of a row.
                if any(source.count(word) > line.count(word) for word in guards):
                    continue
                candidates = [line]
                if line.startswith("ราคา "):
                    candidates.append(line[len("ราคา "):])
                for candidate in candidates:
                    start = source.find(candidate)
                    if start < 0:
                        continue
                    if start and source[start - 1] in "เแโใไ":
                        continue
                    before, after = source[:start], source[start + len(candidate):]
                    # Multiple values/entities must not be projected onto one
                    # item. A full row is required in ambiguous numeric rows.
                    if _factual_tokens(before) or _factual_tokens(after):
                        continue
                    supported = True
                    break
                if supported:
                    break
            if supported:
                break
        if not supported:
            return False
    return bool(lines)


def units_for_evidence_quotes(
    evidence_quotes: Sequence[str], selected_units: Sequence[EvidenceUnit]
) -> list[EvidenceUnit]:
    accepted: list[EvidenceUnit] = []
    normalized_quotes = [normalize_whitespace(quote) for quote in evidence_quotes]
    for unit in selected_units:
        unit_text = normalize_whitespace(unit.text)
        if any(quote in unit_text for quote in normalized_quotes):
            accepted.append(unit)
    return accepted
