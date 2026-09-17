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


def _segment_text(text: str, max_chars: int, overlap: int) -> list[str]:
    lines = (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    first_content_index = next((i for i, line in enumerate(lines) if line.strip()), 0)
    heading = ""
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
        if _is_heading(lines, index, first_content_index):
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
        result.extend(_split_long_text(unit, max_chars, overlap))
    return result


def split_evidence_units(
    docs: Iterable,
    max_chars: int = MAX_EVIDENCE_CHARS,
    overlap: int = EVIDENCE_OVERLAP,
) -> list[EvidenceUnit]:
    units: list[EvidenceUnit] = []
    for doc in docs:
        metadata = dict(getattr(doc, "metadata", {}) or {})
        for index, text in enumerate(
            _segment_text(getattr(doc, "page_content", ""), max_chars, overlap)
        ):
            unit_metadata = dict(metadata)
            unit_metadata["evidence_unit"] = index
            units.append(EvidenceUnit(text=text, metadata=unit_metadata))
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
    threshold = 0.82 if _detect_item_intent(question) else 0.55
    return len(subject) >= 3 and _topic_ratio(subject, evidence) >= threshold


def select_evidence_units(
    question: str,
    units: Sequence[EvidenceUnit],
    limit: int = MAX_SELECTED_EVIDENCE,
) -> list[EvidenceUnit]:
    selected = [unit for unit in units if _topic_matches(question, unit.text)]
    return selected[:limit]


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


def parse_grounded_response(raw: str) -> tuple[GroundedAnswer | None, str | None]:
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
    unit_texts = [normalize_whitespace(unit.text) for unit in selected_units]
    for quote in evidence_quotes:
        normalized_quote = normalize_whitespace(quote)
        if not any(normalized_quote in unit_text for unit_text in unit_texts):
            return False, "unsupported_evidence"
        if not _topic_matches(question, quote):
            return False, "weak_topic_match"

    supported_facts = _factual_tokens("\n".join(evidence_quotes))
    if not _factual_tokens(answer).issubset(supported_facts):
        return False, "unsupported_fact"
    return True, None


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
