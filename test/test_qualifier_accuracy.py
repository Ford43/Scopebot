"""Explicit source scope must survive semantic and direct-answer shortcuts."""

import json
import unittest
from unittest.mock import patch

from langchain_core.documents import Document

from rag.evidence import EvidenceUnit, extract_section_answer, section_matches, unit_topic_matches


class QualifierIdentityTests(unittest.TestCase):
    def test_conflicting_explicit_values_are_not_semantic_matches(self):
        from rag.qualifiers import qualifier_matches

        cases = [
            ("ขั้นตอนปิดร้านสาขาเชียงใหม่", "4. ปิดร้าน (สาขากรุงเทพ)"),
            ("สาขานครพนมต้องทำอะไรบ้าง", "ปิดร้าน สาขาอุดรธานี"),
            ("ขั้นตอนเครื่องรุ่นA", "ตั้งค่าเครื่อง รุ่นB"),
            ("รุ่นA1ราคาเท่าไร", "รุ่นA ราคา 100 บาท"),
            ("ปิดร้านกะเช้าอย่างไร", "ปิดร้าน กะบ่าย"),
            ("สาขา: เชียงใหม่ รุ่น A", "สาขา: เชียงใหม่ | รุ่น: B"),
            ("ขั้นตอนปิดร้านสาขาเซ็นทรัล เวสต์เกต", "4. ปิดร้าน (สาขาเซ็นทรัล พระราม9)"),
        ]
        for question, text in cases:
            with self.subTest(question=question, text=text):
                self.assertFalse(qualifier_matches(question, text))

    def test_matching_values_survive_spacing_punctuation_and_question_suffixes(self):
        from rag.qualifiers import qualifier_matches

        cases = [
            ("สาขาเชียงใหม่ต้องทำอะไรบ้าง", "4. ปิดร้าน (สาขาเชียงใหม่)"),
            ("ขั้นตอนปิดร้าน สาขา: นครพนม", "ปิดร้าน สาขานครพนม"),
            ("ขั้นตอนเครื่องรุ่นa", "ตั้งค่าเครื่อง (รุ่น A)"),
            ("รุ่นA1ราคาเท่าไร", "รุ่น A1 ราคา 100 บาท"),
            ("ปิดร้านกะเช้าอย่างไร", "ปิดร้าน กะ: เช้า"),
            ('ขั้นตอนสาขา "เซ็นทรัล เวสต์เกต"', 'ปิดร้าน (สาขา "เซ็นทรัล เวสต์เกต")'),
            ("ขั้นตอนปิดร้านสาขาเซ็นทรัล เวสต์เกต", "4. ปิดร้าน (สาขาเซ็นทรัล เวสต์เกต)"),
            ("ขั้นตอนปิดร้านสาขาเซ็นทรัล เวสต์เกต", "4. ปิดร้าน สาขาเซ็นทรัล เวสต์เกต\nปิดเครื่องรับชำระเงิน"),
            ("ขั้นตอนปิดร้านสาขาเซ็นทรัล เวสต์เกต", "สาขาเซ็นทรัล เวสต์เกต ปิดเครื่องรับชำระเงิน"),
        ]
        for question, text in cases:
            with self.subTest(question=question, text=text):
                self.assertTrue(qualifier_matches(question, text))

    def test_absent_or_generic_qualifier_does_not_veto_normal_topic_checks(self):
        from rag.qualifiers import qualifier_matches

        for question, text in [
            ("ขั้นตอนปิดร้าน", "ปิดร้าน (สาขากรุงเทพ)"),
            ("ขั้นตอนปิดร้านสาขาเชียงใหม่", "ปิดร้าน\nปิดเครื่องรับชำระเงิน"),
            ("มีรุ่นไหนบ้าง", "รุ่น A และรุ่น B"),
            ("สาขาเชียงใหม่", "ใช้สำหรับสาขาเชียงใหม่และสาขากรุงเทพ"),
            ("สาขาเชียงใหม่ตรวจสต็อกกี่โมง", "วันอังคารสาขาปิด พนักงานตรวจสต็อก 09:00–12:00"),
            ("ตั้งค่าเครื่องรุ่น A", "เครื่องรุ่นใหม่มีปุ่มเริ่มต้น"),
        ]:
            with self.subTest(question=question, text=text):
                self.assertTrue(qualifier_matches(question, text))


class QualifierRewriteTests(unittest.TestCase):
    def prepare(self, question, resolved, alternatives, history=None):
        from rag.semantic import prepare_query

        with patch("rag.semantic.rewrite_client") as client:
            client.return_value.chat.return_value = {"message": {"content": json.dumps(
                {"question": resolved, "queries": alternatives}, ensure_ascii=False)}}
            return prepare_query(question, history)

    def test_every_generated_query_preserves_exact_qualifier_identity(self):
        cases = [
            ("ขั้นตอนปิดร้านสาขาเชียงใหม่", "ขั้นตอนปิดร้านสาขากรุงเทพ"),
            ("ขั้นตอนตั้งค่าเครื่องรุ่น A", "ขั้นตอนตั้งค่าเครื่องรุ่น B"),
            ("ขั้นตอนปิดร้านกะเช้า", "ขั้นตอนปิดร้านกะบ่าย"),
            ("ขั้นตอนปิดร้านสาขาเซ็นทรัล เวสต์เกต", "ขั้นตอนปิดร้านสาขาเซ็นทรัล บางนา"),
            ("ขั้นตอนตั้งค่าเครื่องรุ่น A", "วิธีตั้งค่าเครื่อง"),
            ("ขั้นตอนปิดร้าน", "ขั้นตอนปิดร้านสาขาเชียงใหม่"),
        ]
        for question, alternative in cases:
            with self.subTest(question=question, alternative=alternative):
                plan = self.prepare(question, question, [alternative])
                self.assertEqual(plan.queries, (question,))

    def test_resolved_query_cannot_invent_qualifier_on_unqualified_question(self):
        question = "ขั้นตอนปิดร้าน"
        plan = self.prepare(question, "ขั้นตอนปิดร้านสาขาเชียงใหม่", [])
        self.assertEqual(plan.queries, (question,))

    def test_alternative_can_keep_qualifier_while_changing_question_wording(self):
        question = "ขั้นตอนปิดร้านสาขาเซ็นทรัล เวสต์เกต"
        alternative = "วิธีปิดร้านสาขาเซ็นทรัล เวสต์เกต"
        plan = self.prepare(question, question, [alternative])
        self.assertIn(alternative, plan.queries)

    def test_contextual_alternative_cannot_change_inherited_branch(self):
        question = "แล้วต้องทำอะไร"
        history = [{"question": "ขั้นตอนปิดร้านสาขาเชียงใหม่"}]
        plan = self.prepare(question, "ขั้นตอนปิดร้านสาขาเชียงใหม่",
                            ["ขั้นตอนปิดร้านสาขากรุงเทพ"], history)
        self.assertEqual(plan.queries, (question + "\nบริบทคำถามก่อนหน้า: ขั้นตอนปิดร้านสาขาเชียงใหม่",))


class QualifierSelectionTests(unittest.TestCase):
    def test_conflicting_parenthesized_branch_and_model_do_not_match_section(self):
        cases = [
            ("ขั้นตอนปิดร้านสาขาเชียงใหม่", "4. ปิดร้าน (สาขากรุงเทพ)"),
            ("ขั้นตอนตั้งค่าเครื่องรุ่น A", "4. ตั้งค่าเครื่อง (รุ่น B)"),
            ("ขั้นตอนปิดร้านกะเช้า", "4. ปิดร้าน (กะบ่าย)"),
            ("ขั้นตอนปิดร้านสาขาเซ็นทรัล เวสต์เกต", "4. ปิดร้าน (สาขาเซ็นทรัล พระราม9)"),
        ]
        for question, heading in cases:
            with self.subTest(heading=heading):
                self.assertFalse(section_matches(question, heading))

    def test_matching_qualifiers_work_in_plain_and_parenthesized_headings(self):
        cases = [
            ("ขั้นตอนปิดร้านสาขาเชียงใหม่", "4. ปิดร้าน (สาขาเชียงใหม่)"),
            ("ขั้นตอนปิดร้านสาขาเชียงใหม่", "4. ปิดร้าน สาขาเชียงใหม่"),
            ("ขั้นตอนตั้งค่าเครื่องรุ่น A", "4. ตั้งค่าเครื่อง (รุ่น A)"),
            ("ขั้นตอนปิดร้านกะเช้า", "4. ปิดร้าน (กะเช้า)"),
        ]
        for question, heading in cases:
            with self.subTest(heading=heading):
                self.assertTrue(section_matches(question, heading))

    def test_semantic_score_cannot_override_conflicting_text_or_metadata_scope(self):
        for heading in ("4. ปิดร้าน (สาขากรุงเทพ)", "4. ปิดร้าน สาขากรุงเทพ"):
            for text in (heading + "\nปิดเครื่องรับชำระเงิน", "ปิดเครื่องรับชำระเงิน"):
                with self.subTest(heading=heading, text=text):
                    unit = EvidenceUnit(text, {"source": "manual.pdf", "section": heading,
                                               "semantic_relevance": 0.99})
                    self.assertFalse(unit_topic_matches("ขั้นตอนปิดร้านสาขาเชียงใหม่", unit))

    def test_semantic_section_flag_cannot_override_conflicting_scope(self):
        heading = "4. ตั้งค่าเครื่อง (รุ่น B)"
        unit = EvidenceUnit(heading + "\nกดปุ่มเริ่มต้น", {"source": "manual.pdf", "section": heading,
                                                          "semantic_section_match": True})
        self.assertIsNone(extract_section_answer("ขั้นตอนตั้งค่าเครื่องรุ่น A", [unit]))

    def test_unqualified_section_answer_keeps_its_source_scope(self):
        for heading in ("4. ปิดร้าน (สาขากรุงเทพ)", "4. ปิดร้าน สาขากรุงเทพ"):
            with self.subTest(heading=heading):
                unit = EvidenceUnit(heading + "\nปิดเครื่องรับชำระเงิน", {"source": "manual.pdf", "section": heading})
                result = extract_section_answer("ขั้นตอนปิดร้าน", [unit])
                self.assertIsNotNone(result)
                self.assertIn("สาขากรุงเทพ", result.answer)
                self.assertIn("ปิดเครื่องรับชำระเงิน", result.answer)

    def test_unqualified_question_does_not_choose_between_qualified_sections(self):
        units = [EvidenceUnit(heading + "\nปิดเครื่องรับชำระเงิน", {"source": "manual.pdf", "section": heading})
                 for heading in ("4. ปิดร้าน (สาขากรุงเทพ)", "4. ปิดร้าน (สาขาเชียงใหม่)")]
        self.assertIsNone(extract_section_answer("ขั้นตอนปิดร้าน", units))

    def test_pipeline_declines_wrong_branch_even_with_semantic_approval(self):
        from rag import rag_pipeline

        heading = "4. ปิดร้าน (สาขากรุงเทพ)"
        doc = Document(page_content=heading + "\n- ปิดเครื่องรับชำระเงิน",
                       metadata={"source": "manual.pdf", "section": heading, "semantic_relevance": 0.99})
        with patch.object(rag_pipeline, "retrieve_docs", return_value=[doc]), patch.object(
            rag_pipeline, "generate_answer", side_effect=AssertionError("Conflicting scope must be rejected before generation")
        ):
            answer, sources = rag_pipeline.ask_rag("ขั้นตอนปิดร้านสาขาเชียงใหม่", "test")
        self.assertEqual((answer, sources), ("REQUIRE_HUMAN_HANDOFF", []))


if __name__ == "__main__":
    unittest.main()
