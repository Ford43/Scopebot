import unittest
from unittest.mock import patch
from langchain_core.documents import Document
from rag import rag_pipeline

class CodeAnswerTests(unittest.TestCase):
    def test_overlapping_chunk_with_other_tour_is_excluded(self):
        from rag.evidence import EvidenceUnit, unit_topic_matches
        self.assertFalse(unit_topic_matches('TOUR-021 รวมอะไรบ้าง', EvidenceUnit('TOUR-020 คืนเงิน 7 วัน TOUR-021 ราคา 7330 บาท', {})))

    def test_exact_code_returns_original_csv_row_without_model_paraphrase(self):
        docs=[Document(page_content='รหัสสินค้า: INV-015 | ราคา_บาท: 745 | คงเหลือ_ชิ้น: 20', metadata={'source':'inventory.csv'})]
        with patch.object(rag_pipeline,'retrieve_docs',return_value=docs), patch.object(rag_pipeline.ollama,'chat') as model:
            answer,sources=rag_pipeline.ask_rag('INV-015 ราคาเท่าไร เหลือกี่ชิ้น','test')
        self.assertIn('745',answer)
        self.assertTrue(sources)
        model.assert_not_called()

    def test_wrong_code_is_never_accepted(self):
        docs=[Document(page_content='INV-016 ราคา 800 บาท',metadata={'source':'inventory.csv','semantic_relevance':.99})]
        with patch.object(rag_pipeline,'retrieve_docs',return_value=docs),patch.object(rag_pipeline.ollama,'chat') as model:
            answer,_=rag_pipeline.ask_rag('INV-015 ราคาเท่าไร','test')
        self.assertEqual(answer,'REQUIRE_HUMAN_HANDOFF')
        model.assert_not_called()
