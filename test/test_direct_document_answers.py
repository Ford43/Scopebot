import unittest
from unittest.mock import patch
from langchain_core.documents import Document
from rag import rag_pipeline
from rag.evidence import build_retrieval_query


class DirectDocumentAnswers(unittest.TestCase):
    def test_bounded_lookup_exact_section_and_facts(self):
        from rag.retriever import _exact_evidence_documents
        docs = [Document(page_content='4. ปิดร้าน (กะบ่าย)\n- last order 20:30 น.', metadata={'source': 'manual.pdf', 'section': '4. ปิดร้าน (กะบ่าย)', 'unit_order': 0})]
        class Store:
            def get(self, **kwargs):
                return {'documents': [d.page_content for d in docs], 'metadatas': [d.metadata for d in docs]}
        self.assertEqual(len(_exact_evidence_documents(Store(), 'ขั้นตอนปิดร้านกะบ่าย')), 1)
        self.assertEqual(len(_exact_evidence_documents(Store(), 'ขั้นตอนปิดร้านกะบ่ายต้องทำอะไรบ้าง')), 1)
        self.assertEqual(_exact_evidence_documents(Store(), 'ขั้นตอนปิดร้านกะบ่ายวันอังคาร'), [])
        docs.append(Document(page_content=docs[0].page_content, metadata={**docs[0].metadata, 'source': 'other.pdf'}))
        self.assertEqual(_exact_evidence_documents(Store(), 'ขั้นตอนปิดร้านกะบ่าย'), [])

    def answer(self, question, text, source, history=None):
        with patch.object(rag_pipeline, 'retrieve_docs', return_value=[Document(page_content=text, metadata={'source': source})]), patch.object(rag_pipeline, 'generate_answer', side_effect=AssertionError('Direct evidence needs no model')):
            return rag_pipeline.ask_rag(question, 'test', history=history)

    def test_diagnostic_price_and_duration_preserve_condition(self):
        text = 'การตรวจอาการก่อนซ่อม\nค่าตรวจวิเคราะห์อาการเบื้องต้น 350 บาท ใช้เวลาประมาณ 45 นาที ครอบคลุมการสอบถามอาการ ตรวจด้วยสายตา และทดลองเดินเครื่องในพื้นที่อู่ หากต้องรื้อชิ้นส่วนจะเสนอค่าตรวจเพิ่มเติมให้อนุมัติก่อน'
        answer, sources = self.answer('ค่าตรวจอาการรถราคาเท่าไร ใช้เวลากี่นาที', text, 'garage.docx')
        self.assertIn('350 บาท', answer)
        self.assertIn('45 นาที', answer)
        self.assertIn('หากต้องรื้อชิ้นส่วน', answer)
        self.assertTrue(sources)

    def test_tuesday_stock_check_preserves_schedule(self):
        text = '2. กะงาน\n- วันอังคารสาขาปิด พนักงานกะเช้าเวียนมาตรวจสต็อก 09:00–12:00 น. ตามตารางเดือน'
        answer, sources = self.answer('วันอังคารตรวจสต็อกกี่โมง', text, 'manual.pdf')
        self.assertIn('09:00–12:00', answer)
        self.assertIn('ตามตารางเดือน', answer)
        self.assertTrue(sources)

    def test_location_followup_uses_question_identifier_only(self):
        history = [{'question': 'INV-002 เหลือกี่ชิ้น', 'answer': 'INV-999 อยู่ที่อื่น'}]
        query = build_retrieval_query('แล้วเก็บอยู่ตรงไหน', history)
        self.assertIn('INV-002', query)
        self.assertNotIn('INV-999', query)
        answer, sources = self.answer('แล้วเก็บอยู่ตรงไหน', 'รหัสสินค้า: INV-002 | คงเหลือ_ชิ้น: 19 | ที่เก็บ: อาคาร K ชั้น 1 ช่อง 02', 'inventory.csv', history)
        self.assertIn('อาคาร K ชั้น 1 ช่อง 02', answer)
        self.assertTrue(sources)

    def test_identifier_followup_does_not_answer_missing_requested_field(self):
        history = [{'question': 'INV-002 เหลือกี่ชิ้น'}]
        answer, sources = self.answer('แล้วหมดอายุวันไหน', 'รหัสสินค้า: INV-002 | คงเหลือ_ชิ้น: 19 | ที่เก็บ: อาคาร K ชั้น 1 ช่อง 02', 'inventory.csv', history)
        self.assertEqual(answer, 'REQUIRE_HUMAN_HANDOFF')
        self.assertEqual(sources, [])

    def test_identifier_followup_requires_nonempty_field_value(self):
        for value in ('', '-', 'N/A', 'ไม่ระบุ'):
            answer, sources = self.answer('แล้วเก็บอยู่ตรงไหน', 'รหัสสินค้า: INV-002 | คงเหลือ_ชิ้น: 19 | ที่เก็บ: ' + value, 'inventory.csv', [{'question': 'INV-002 เหลือกี่ชิ้น'}])
            self.assertEqual(answer, 'REQUIRE_HUMAN_HANDOFF')
            self.assertEqual(sources, [])

    def test_explicit_identifier_supersedes_history_identifier(self):
        history = [{'question': 'INV-002 เหลือกี่ชิ้น'}]
        self.assertEqual(build_retrieval_query('แล้ว INV-003 เหลือกี่ชิ้น', history), 'แล้ว INV-003 เหลือกี่ชิ้น')
        self.assertEqual(build_retrieval_query('แล้ว INV-002 กับ INV-003 ต่างกันอย่างไร', history), 'แล้ว INV-002 กับ INV-003 ต่างกันอย่างไร')
        from rag.semantic import prepare_query
        with patch('rag.semantic.rewrite_client', side_effect=RuntimeError('offline')):
            plan = prepare_query('แล้ว INV-003 เหลือกี่ชิ้น', history)
        self.assertNotIn('INV-002', plan.question)
        chain = history + [{'question': 'แล้ว INV-003 เหลือกี่ชิ้น'}]
        self.assertNotIn('INV-002', build_retrieval_query('แล้วเก็บอยู่ตรงไหน', chain))
        with patch('rag.semantic.rewrite_client', side_effect=RuntimeError('offline')):
            self.assertNotIn('INV-002', prepare_query('แล้วเก็บอยู่ตรงไหน', chain).question)

    def test_fact_matching_rejects_wrong_day_and_ambiguous_sources(self):
        from rag.evidence import direct_fact_matches, extract_direct_fact_answer, EvidenceUnit
        self.assertFalse(direct_fact_matches('วันพุธตรวจสต็อกกี่โมง', 'วันอังคารตรวจสต็อก 09:00–12:00'))
        text = 'ค่าตรวจวิเคราะห์อาการเบื้องต้น 350 บาท ใช้เวลาประมาณ 45 นาที'
        self.assertFalse(direct_fact_matches('ตรวจระบบเบรกราคาเท่าไร', text))
        self.assertFalse(direct_fact_matches('ตรวจวิเคราะห์อาการเบื้องต้นนานเท่าไหร่', 'ค่าตรวจวิเคราะห์อาการเบื้องต้น 350 บาท'))
        self.assertFalse(direct_fact_matches('ตรวจวิเคราะห์อาการเบื้องต้นราคาเท่าไร', 'ตรวจวิเคราะห์อาการเบื้องต้น กรุณาสอบถามราคา; เปลี่ยนยางราคา 350 บาท'))
        self.assertFalse(direct_fact_matches('วันอังคารตรวจสต็อกกี่โมง', 'วันอังคารงดตรวจสต็อก วันพุธตรวจสต็อก 09:00–12:00 น.'))
        units = [EvidenceUnit(text, {'source': name}) for name in ('one.docx', 'two.docx')]
        self.assertIsNone(extract_direct_fact_answer('ตรวจวิเคราะห์อาการเบื้องต้นราคาเท่าไร', units))

    def test_real_entry_loaders_preserve_reported_evidence(self):
        from pathlib import Path
        from rag.document_loader import load_docx, load_pdf_pages, load_csv
        from rag.chunker import split_documents
        root = Path(__file__).resolve().parents[1] / 'data' / 'bot_bea29390'
        if not (root / 'garage_service_test.docx').exists():
            self.skipTest('Local reported-case documents are unavailable')
        documents = [Document(page_content=load_docx(root / 'garage_service_test.docx'), metadata={'source': 'garage_service_test.docx'}),
                     Document(page_content=load_csv(root / '01_inventory.csv'), metadata={'source': '01_inventory.csv'})]
        documents += load_pdf_pages(next(root.glob('*.pdf')), {'source': 'manual.pdf'})
        from rag.retriever import _exact_evidence_documents
        chunks = split_documents(documents)
        class Store:
            def get(self, **kwargs):
                return {'documents': [d.page_content for d in chunks], 'metadatas': [d.metadata for d in chunks]}
        for question, expected in [('ตรวจวิเคราะห์อาการเบื้องต้นราคาเท่าไร ใช้เวลากี่นาที', '350 บาท'), ('วันอังคารตรวจสต็อกกี่โมง', '09:00–12:00'), ('ขั้นตอนปิดร้านกะบ่าย', '20:30')]:
            docs = _exact_evidence_documents(Store(), question)
            self.assertTrue(docs, question)
            with patch.object(rag_pipeline, 'retrieve_docs', return_value=docs), patch.object(rag_pipeline, 'generate_answer', side_effect=AssertionError('No model')):
                answer, sources = rag_pipeline.ask_rag(question, 'test')
            self.assertIn(expected, answer)
            self.assertTrue(sources)
