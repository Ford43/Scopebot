import json
import unittest
from unittest.mock import patch

from langchain_core.documents import Document
from rag import rag_pipeline
from rag.chunker import split_documents
from rag.evidence import EvidenceUnit, split_evidence_units, validate_grounded_answer


class ConditionAccuracyTests(unittest.TestCase):
    def test_receipt_clauses_without_must_cannot_be_removed_or_cropped(self):
        cases = [
            ('รับคืนสินค้าได้ โดยแสดงใบเสร็จ', 'รับคืนสินค้าได้'),
            ('รับคืนสินค้าได้ โดยมีใบเสร็จ', 'รับคืนสินค้าได้'),
            ('รับคืนสินค้าได้ โดยแสดงใบเสร็จ', 'รับคืนสินค้าได้ โดยแสดง'),
            ('Refunds available with receipt', 'Refunds available'),
            ('Refunds available with original receipt', 'Refunds available with'),
        ]
        for text, answer in cases:
            with self.subTest(text=text, answer=answer):
                unit = EvidenceUnit(text, {'semantic_relevance': .99})
                self.assertFalse(validate_grounded_answer('นโยบายคืนสินค้า', answer, [text], [unit])[0])
                self.assertTrue(validate_grounded_answer('นโยบายคืนสินค้า', text, [text], [unit])[0])

    def test_receipt_clause_variants_cannot_escape_pipeline_validation(self):
        for clause in ('โดยแสดงใบเสร็จ', 'โดยมีใบเสร็จ'):
            with self.subTest(clause=clause):
                text = 'นโยบายคืนสินค้า: รับคืนสินค้าได้ ' + clause
                doc = Document(page_content=text, metadata={'source': 'policy.txt', 'semantic_relevance': .99})
                with patch.object(rag_pipeline, 'retrieve_docs', return_value=[doc]), patch.object(
                    rag_pipeline, 'generate_answer', return_value={'message': {'content': json.dumps({
                        'answer': 'รับคืนสินค้าได้', 'evidence_ids': [1]})}}
                ):
                    self.assertEqual(rag_pipeline.ask_rag('รับคืนสินค้าได้ไหม', 'test'), ('REQUIRE_HUMAN_HANDOFF', []))
                with patch.object(rag_pipeline, 'retrieve_docs', return_value=[doc]), patch.object(
                    rag_pipeline, 'generate_answer', return_value={'message': {'content': json.dumps({
                        'answer': text, 'evidence_ids': [1]})}}
                ):
                    answer, sources = rag_pipeline.ask_rag('รับคืนสินค้าได้ไหม', 'test')
                    self.assertEqual(answer, text)
                    self.assertEqual(sources[0]['filename'], 'policy.txt')
                    self.assertIn(clause, sources[0]['snippet'])

    def test_separate_receipt_clause_is_retained_in_search_chunks(self):
        for clause in ('โดยแสดงใบเสร็จ', 'โดยมีใบเสร็จ'):
            with self.subTest(clause=clause):
                text = 'นโยบายคืนสินค้า\n- รับคืนสินค้าได้\n- ' + clause
                chunks = split_documents([Document(page_content=text, metadata={'source': 'policy.txt'})])
                hit = next(c for c in chunks if 'รับคืนสินค้าได้' in c.page_content)
                units = split_evidence_units([hit])
                self.assertIn(clause, units[0].text)
                self.assertFalse(validate_grounded_answer('รับคืนสินค้าได้ไหม', 'รับคืนสินค้าได้', [units[0].text], units)[0])

    def test_adjacent_requirement_is_retained_from_a_single_search_hit(self):
        for text in ('นโยบายคืนสินค้า\n- รับคืนสินค้าได้\n- โดยต้องมีใบเสร็จ',
                     'นโยบายคืนสินค้า\n- สำหรับสมาชิก\n- รับคืนสินค้าได้'):
            chunks = split_documents([Document(page_content=text, metadata={'source': 'policy.txt'})])
            hit = next(c for c in chunks if 'รับคืนสินค้าได้' in c.page_content)
            units = split_evidence_units([hit])
            self.assertIn('รับคืนสินค้าได้', units[0].text)
            self.assertTrue('โดยต้องมีใบเสร็จ' in units[0].text or 'สำหรับสมาชิก' in units[0].text)
            self.assertFalse(validate_grounded_answer('รับคืนสินค้าได้ไหม', 'รับคืนสินค้าได้', [units[0].text], units)[0])

    def test_legacy_indexed_sibling_requirement_cannot_be_ignored(self):
        units = [EvidenceUnit('นโยบายคืนสินค้า\n' + text, {
            'source': 'policy.txt', 'section': 'นโยบายคืนสินค้า', 'evidence_unit': i,
        }) for i, text in enumerate(('รับคืนสินค้าได้', 'โดยต้องมีใบเสร็จ'))]
        self.assertFalse(validate_grounded_answer('รับคืนสินค้าได้ไหม', 'รับคืนสินค้าได้', [units[0].text], units)[0])
        self.assertTrue(validate_grounded_answer('รับคืนสินค้าได้ไหม', 'รับคืนสินค้าได้\nโดยต้องมีใบเสร็จ', [u.text for u in units], units)[0])

    def test_required_clauses_cannot_be_cropped_or_replaced(self):
        cases = [
            ('รับคืนสินค้าได้ โดยต้องมีใบเสร็จ', 'รับคืนสินค้าได้'),
            ('รับคืนสินค้าได้ แต่ต้องมีใบเสร็จ', 'รับคืนสินค้าได้'),
            ('รับคืนสินค้าได้ สำหรับสมาชิก', 'รับคืนสินค้าได้'),
            ('No refunds', 'refunds'),
            ('non-refundable', 'refundable'),
            ('รับคืนสินค้าได้ โดยต้องมีใบเสร็จ', 'รับคืนสินค้าได้ โดยต้อง'),
            ('สำหรับสมาชิก\nรับคืนสินค้าได้', 'รับคืนสินค้าได้'),
        ]
        for text, answer in cases:
            with self.subTest(text=text, answer=answer):
                unit = EvidenceUnit(text, {'semantic_relevance': .99})
                self.assertFalse(validate_grounded_answer('นโยบายคืนสินค้า', answer, [text], [unit])[0])
                self.assertTrue(validate_grounded_answer('นโยบายคืนสินค้า', text, [text], [unit])[0])

    def test_model_cannot_publish_a_receipt_free_return_policy(self):
        text = 'นโยบายคืนสินค้า: รับคืนสินค้าได้ โดยต้องมีใบเสร็จ'
        doc = Document(page_content=text, metadata={'source': 'policy.txt', 'semantic_relevance': .99})
        with patch.object(rag_pipeline, 'retrieve_docs', return_value=[doc]), patch.object(
            rag_pipeline, 'generate_answer', return_value={'message': {'content': json.dumps({
                'answer': 'รับคืนสินค้าได้', 'evidence_ids': [1]})}}
        ):
            self.assertEqual(rag_pipeline.ask_rag('รับคืนสินค้าได้ไหม', 'test'), ('REQUIRE_HUMAN_HANDOFF', []))

    def test_long_record_retains_price_conditions_even_from_one_search_hit(self):
        text = ('ค่าตรวจวิเคราะห์อาการเบื้องต้น ราคา 350 บาท ' +
                'ครอบคลุมการสอบถามอาการและตรวจอุปกรณ์ภายนอก ' * 16 +
                'เฉพาะรถเบนซินเท่านั้น รถดีเซลราคา 900 บาท')
        chunks = split_documents([Document(page_content=text, metadata={'source': 'garage.txt'})])
        self.assertGreater(len(chunks), 1)
        hit = next(c for c in chunks if '350 บาท' in c.page_content)
        with patch.object(rag_pipeline, 'retrieve_docs', return_value=[hit]), patch.object(rag_pipeline, 'generate_answer') as model:
            answer, sources = rag_pipeline.ask_rag('ตรวจวิเคราะห์อาการเบื้องต้นราคาเท่าไร', 'test')
        self.assertIn('เฉพาะรถเบนซินเท่านั้น', answer)
        self.assertIn('900 บาท', answer)
        self.assertTrue(sources)
        model.assert_not_called()

    def test_expanded_record_is_deduplicated_and_survives_second_pass(self):
        text = 'บริการตรวจอาการ\nราคา 350 บาท ' + 'รายละเอียดการตรวจ ' * 65 + 'ต้องนัดหมายก่อนเข้ารับบริการ'
        chunks = split_documents([Document(page_content=text, metadata={'source': 'garage.txt'})])
        units = split_evidence_units(chunks)
        self.assertEqual(len(units), 1)
        self.assertIn('ต้องนัดหมาย', units[0].text)
        self.assertEqual(units, split_evidence_units(units))

    def test_oversized_record_is_not_presented_as_complete(self):
        text = 'ค่าตรวจวิเคราะห์อาการเบื้องต้น ราคา 350 บาท ' + 'รายละเอียดการตรวจ ' * 300 + 'เฉพาะรถเบนซิน'
        chunks = split_documents([Document(page_content=text, metadata={'source': 'garage.txt'})])
        hit = next(c for c in chunks if '350 บาท' in c.page_content)
        with patch.object(rag_pipeline, 'retrieve_docs', return_value=[hit]), patch.object(rag_pipeline, 'generate_answer') as model:
            self.assertEqual(rag_pipeline.ask_rag('ตรวจวิเคราะห์อาการเบื้องต้นราคาเท่าไร', 'test'), ('REQUIRE_HUMAN_HANDOFF', []))
        model.assert_not_called()
