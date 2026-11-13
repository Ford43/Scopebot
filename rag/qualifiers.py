"""Conservative identity checks for explicitly labelled document scope.

These checks only veto a conflict. An absent qualifier is not evidence that a
passage answers the question; normal topic and grounding checks still apply.
"""

from __future__ import annotations

import re
import unicodedata


_SHIFTS = r"กลางวัน|กลางคืน|พิเศษ|เช้า|บ่าย|เย็น|ดึก"
_LABEL = re.compile(rf"สาขา|รุ่น|กะ(?=\s*[:：]?\s*(?:{_SHIFTS}))")
_QUESTION_OR_CLAUSE = re.compile(unicodedata.normalize("NFKC",
    r"ต้องทำ|มีอะไร|มีขั้นตอน|คืออะไร|อย่างไร|ยังไง|ขั้นตอน|วิธี|"
    r"ราคา|ใช้เวลา|กี่โมง|กี่บาท|กี่นาที|เปิดร้าน|ปิดร้าน|เปิดกี่|ปิดกี่|"
    r"เข้างาน|เริ่มงาน|ทำงาน|ตรวจ|ตั้งค่า|สำหรับ|เฉพาะ|ยกเว้น|เท่านั้น|และ|กับ|หรือ|ครับ|ค่ะ|คะ|"
    r"(?<=\s)(?:ปิดเครื่อง|เปิดเครื่อง|กดปุ่ม|ให้|ต้อง|ห้าม|ควร|สามารถ)"
))
_GENERIC_VALUES = {"ไหน", "ใด", "อะไร", "ไหนบ้าง", "ใดบ้าง", "อะไรบ้าง", "ทั้งหมด", "ทุก", "งาน",
                   "เปิด", "ปิด", "ใหม่", "เก่า", "นี้", "นั้น", "เดียวกัน"}
_GENERIC_MODIFIER = re.compile(r"^(?:(?:ใหม่|เก่า|นี้|นั้น|เดียวกัน)(?:มี|ที่|ต้อง|$|\s)|(?:เปิด|ปิด)(?:$|\s))")


def _qualifiers(text: str) -> dict[str, set[str]]:
    text = unicodedata.normalize("NFKC", text).casefold()
    found: dict[str, set[str]] = {}
    labels = list(_LABEL.finditer(text))
    for index, label in enumerate(labels):
        tail = text[label.end():labels[index + 1].start() if index + 1 < len(labels) else len(text)]
        tail = tail.lstrip(" \t:：")
        if label.group() == "กะ":
            shift = re.match(_SHIFTS, tail)
            value = shift.group() if shift else ""
        elif tail.startswith(('"', "'", "“", "‘")):
            closing = {'"': '"', "'": "'", "“": "”", "‘": "’"}[tail[0]]
            value = tail[1:].split(closing, 1)[0]
        else:
            # Labels delimit values without requiring Thai word boundaries.
            # Keep every word of a labelled name. Only punctuation and explicit
            # question/instruction clauses end it; the first word alone cannot
            # distinguish e.g. branches in different malls of the same chain.
            tail = re.split(r"[\n\r()\[\]{}|,;:：!?\"'“”‘’]", tail, maxsplit=1)[0]
            tail = _QUESTION_OR_CLAUSE.split(tail, maxsplit=1)[0]
            if _GENERIC_MODIFIER.match(tail):
                continue
            if re.match(r"[a-z0-9]", tail):
                token = re.match(r"[a-z0-9][a-z0-9._/-]*(?:[ \t]+[a-z0-9][a-z0-9._/-]*)*", tail)
                value = token.group() if token else ""
            else:
                value = tail
        value = re.sub(r"\s+", "", value).strip("._/-")
        if value and value not in _GENERIC_VALUES:
            found.setdefault(label.group(), set()).add(value)
    return found


def qualifier_matches(question: str, text: str) -> bool:
    """Reject disjoint explicit branch/model/shift values before semantic approval.

    Pass both a unit's section metadata and text when scope may only live in
    metadata. Broad questions and unqualified evidence continue through normal
    selection; callers must retain source headings in any extracted answer.
    """
    requested, mentioned = _qualifiers(question), _qualifiers(text)
    return all(not values.isdisjoint(mentioned[label])
               for label, values in requested.items() if label in mentioned)


def qualifiers_preserved(question: str, candidate: str) -> bool:
    """A generated search query must neither add nor remove explicit scope."""
    return _qualifiers(question) == _qualifiers(candidate)
