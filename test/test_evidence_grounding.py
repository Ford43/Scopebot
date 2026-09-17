import json
import types
import unittest
from unittest.mock import patch


GARAGE_TEXT = """อู่ซ่อมรถพี่เอกการช่าง
เวลาเปิด: จันทร์–เสาร์ 08:00–17:30 น. หยุดอาทิตย์และวันแรงงาน

บริการยอดใช้
- เปลี่ยนน้ำมันเครื่องเบนซินสังเคราะห์: 1,490 บาท รวมกรอง ใช้เวลา 40 นาที
- เปลี่ยนน้ำมันเครื่องดีเซล: 1,890 บาท รวมกรอง ใช้เวลา 50 นาที
"""


def _doc(text=GARAGE_TEXT):
    return types.SimpleNamespace(
        page_content=text,
        metadata={"source": "อู่ซ่อมรถพี่เอกการช่าง.txt"},
    )


class EvidenceUnitTests(unittest.TestCase):
    def test_ingest_chunker_keeps_service_bullets_separate(self):
        from langchain_core.documents import Document
        from rag.chunker import split_documents

        chunks = split_documents(
            [Document(page_content=GARAGE_TEXT, metadata={"source": "garage.txt"})]
        )
        service_chunks = [chunk.page_content for chunk in chunks if "เปลี่ยนน้ำมันเครื่อง" in chunk.page_content]

        self.assertEqual(len(service_chunks), 2)
        self.assertFalse(any("1,490" in text and "1,890" in text for text in service_chunks))

    def test_legacy_chunk_is_split_into_independent_service_units(self):
        from rag.evidence import split_evidence_units

        units = split_evidence_units([_doc()])
        service_units = [unit.text for unit in units if "เปลี่ยนน้ำมันเครื่อง" in unit.text]

        self.assertEqual(len(service_units), 2)
        self.assertFalse(any("1,490" in text and "1,890" in text for text in service_units))

    def test_itemized_price_requires_the_requested_subject(self):
        from rag.evidence import select_evidence_units, split_evidence_units

        units = split_evidence_units([_doc()])

        self.assertEqual(
            select_evidence_units("เปลี่ยนหัวเทียนราคาเท่าไหร่ครับ", units),
            [],
        )
        selected = select_evidence_units(
            "เปลี่ยนน้ำมันเครื่องเบนซินราคาเท่าไหร่ครับ", units
        )
        self.assertEqual(len(selected), 1)
        self.assertIn("1,490 บาท", selected[0].text)

    def test_global_opening_hours_intent_selects_only_hours(self):
        from rag.evidence import select_evidence_units, split_evidence_units

        units = split_evidence_units([_doc()])
        selected = select_evidence_units("อู่เปิดปิดกี่โมงครับ", units)

        self.assertEqual(len(selected), 1)
        self.assertIn("จันทร์–เสาร์", selected[0].text)

    def test_validator_rejects_factual_day_not_present_in_evidence(self):
        from rag.evidence import validate_grounded_answer, split_evidence_units

        units = split_evidence_units([_doc()])
        selected = select_hours = [u for u in units if "เวลาเปิด" in u.text]
        valid, reason = validate_grounded_answer(
            "อู่เปิดปิดกี่โมงครับ",
            "เปิดวันจันทร์ถึงวันศุกร์ เวลา 08:00–17:30 น.",
            ["เวลาเปิด: จันทร์–เสาร์ 08:00–17:30 น. หยุดอาทิตย์และวันแรงงาน"],
            selected,
        )

        self.assertFalse(valid)
        self.assertEqual(reason, "unsupported_fact")

    def test_unrelated_history_is_not_added_to_retrieval_query(self):
        from rag.evidence import build_retrieval_query

        history = [{"question": "อู่เปิดกี่โมง", "answer": "08:00"}]

        self.assertEqual(
            build_retrieval_query("เปลี่ยนหัวเทียนราคาเท่าไหร่", history),
            "เปลี่ยนหัวเทียนราคาเท่าไหร่",
        )
        self.assertEqual(
            build_retrieval_query("แล้วราคาเท่าไหร่", history),
            "อู่เปิดกี่โมง\nแล้วราคาเท่าไหร่",
        )


class EvidenceGatedPipelineTests(unittest.TestCase):
    def test_invalid_model_json_hands_off_after_one_model_call(self):
        from rag import rag_pipeline

        with patch.object(rag_pipeline, "retrieve_docs", return_value=[_doc()]), patch.object(
            rag_pipeline.ollama,
            "chat",
            return_value={"message": {"content": "ราคา 1,490 บาท"}},
        ) as chat:
            answer, sources = rag_pipeline.ask_rag(
                "เปลี่ยนน้ำมันเครื่องเบนซินราคาเท่าไหร่ครับ", "bot_garage"
            )

        self.assertEqual((answer, sources), ("REQUIRE_HUMAN_HANDOFF", []))
        chat.assert_called_once()

    def test_fabricated_evidence_quote_is_rejected(self):
        from rag import rag_pipeline

        payload = json.dumps(
            {
                "answer": "ราคา 1,490 บาท",
                "evidence": ["เปลี่ยนหัวเทียน: 1,490 บาท"],
            },
            ensure_ascii=False,
        )
        with patch.object(rag_pipeline, "retrieve_docs", return_value=[_doc()]), patch.object(
            rag_pipeline.ollama,
            "chat",
            return_value={"message": {"content": payload}},
        ):
            answer, sources = rag_pipeline.ask_rag(
                "เปลี่ยนน้ำมันเครื่องเบนซินราคาเท่าไหร่ครับ", "bot_garage"
            )

        self.assertEqual((answer, sources), ("REQUIRE_HUMAN_HANDOFF", []))

    def test_number_not_present_in_evidence_is_rejected(self):
        from rag import rag_pipeline

        evidence = "เปลี่ยนน้ำมันเครื่องเบนซินสังเคราะห์: 1,490 บาท รวมกรอง ใช้เวลา 40 นาที"
        payload = json.dumps(
            {
                "answer": "ราคา 1,990 บาท รวมกรอง ใช้เวลา 40 นาที",
                "evidence": [evidence],
            },
            ensure_ascii=False,
        )
        with patch.object(rag_pipeline, "retrieve_docs", return_value=[_doc()]), patch.object(
            rag_pipeline.ollama,
            "chat",
            return_value={"message": {"content": payload}},
        ):
            answer, sources = rag_pipeline.ask_rag(
                "เปลี่ยนน้ำมันเครื่องเบนซินราคาเท่าไหร่ครับ", "bot_garage"
            )

        self.assertEqual((answer, sources), ("REQUIRE_HUMAN_HANDOFF", []))

    def test_unknown_service_hands_off_without_calling_model(self):
        from rag import rag_pipeline

        with patch.object(rag_pipeline, "retrieve_docs", return_value=[_doc()]), patch.object(
            rag_pipeline.ollama, "chat"
        ) as chat:
            answer, sources = rag_pipeline.ask_rag(
                "เปลี่ยนหัวเทียนราคาเท่าไหร่ครับ", "bot_garage"
            )

        self.assertEqual(answer, "REQUIRE_HUMAN_HANDOFF")
        self.assertEqual(sources, [])
        chat.assert_not_called()

    def test_supported_service_accepts_structured_answer_and_exact_evidence(self):
        from rag import rag_pipeline

        evidence = "เปลี่ยนน้ำมันเครื่องเบนซินสังเคราะห์: 1,490 บาท รวมกรอง ใช้เวลา 40 นาที"
        payload = json.dumps(
            {
                "answer": "ราคา 1,490 บาท รวมกรอง ใช้เวลา 40 นาที",
                "evidence": [evidence],
            },
            ensure_ascii=False,
        )
        with patch.object(rag_pipeline, "retrieve_docs", return_value=[_doc()]), patch.object(
            rag_pipeline.ollama,
            "chat",
            return_value={"message": {"content": payload}},
        ):
            answer, sources = rag_pipeline.ask_rag(
                "เปลี่ยนน้ำมันเครื่องเบนซินราคาเท่าไหร่ครับ", "bot_garage"
            )

        self.assertEqual(answer, "ราคา 1,490 บาท รวมกรอง ใช้เวลา 40 นาที")
        self.assertEqual(sources[0]["filename"], "อู่ซ่อมรถพี่เอกการช่าง.txt")

    def test_model_day_corruption_is_rejected(self):
        from rag import rag_pipeline

        evidence = "เวลาเปิด: จันทร์–เสาร์ 08:00–17:30 น. หยุดอาทิตย์และวันแรงงาน"
        payload = json.dumps(
            {
                "answer": "เปิดวันจันทร์ถึงวันศุกร์ เวลา 08:00–17:30 น.",
                "evidence": [evidence],
            },
            ensure_ascii=False,
        )
        with patch.object(rag_pipeline, "retrieve_docs", return_value=[_doc()]), patch.object(
            rag_pipeline.ollama,
            "chat",
            return_value={"message": {"content": payload}},
        ):
            answer, sources = rag_pipeline.ask_rag("อู่เปิดปิดกี่โมงครับ", "bot_garage")

        self.assertEqual(answer, "REQUIRE_HUMAN_HANDOFF")
        self.assertEqual(sources, [])


if __name__ == "__main__":
    unittest.main()
