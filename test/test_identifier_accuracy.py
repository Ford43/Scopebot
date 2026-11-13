"""Identifier boundaries must not disappear when Thai words touch a code."""
import json
import unittest
from unittest.mock import patch

from langchain_core.documents import Document

from rag import rag_pipeline
from rag.evidence import EvidenceUnit, _factual_tokens, build_retrieval_query, unit_topic_matches
from rag.semantic import prepare_query


class IdentifierAccuracyTests(unittest.TestCase):
    questions = ('INV-015ราคาเท่าไร', 'สินค้าINV-015 ราคาเท่าไร', 'สินค้าiNv-015ราคาเท่าไร')

    def test_thai_adjacent_identifier_rejects_wrong_semantic_record(self):
        wrong = EvidenceUnit('รหัสสินค้า: INV-016 | ราคา_บาท: 800', {'semantic_relevance': .99})
        for question in self.questions:
            with self.subTest(question=question):
                self.assertFalse(unit_topic_matches(question, wrong))

    def test_identifier_matches_thai_adjacent_document_text_and_case(self):
        unit = EvidenceUnit('สินค้าinv-015ราคา 745 บาท', {})
        self.assertTrue(unit_topic_matches('INV-015 ราคาเท่าไร', unit))

    def test_conflicting_identifier_in_same_family_is_rejected(self):
        unit = EvidenceUnit('สินค้าINV-015 ราคา 745 บาท และสินค้าINV-016 ราคา 800 บาท', {'semantic_relevance': .99})
        self.assertFalse(unit_topic_matches('สินค้าINV-015ราคาเท่าไร', unit))

    def test_identifier_match_never_uses_a_partial_prefix(self):
        for text in ('INV-0150', 'INV-015-A', 'XINV-015', 'INV-015_extra'):
            with self.subTest(text=text):
                self.assertFalse(unit_topic_matches('INV-015 ราคาเท่าไร', EvidenceUnit(text, {'semantic_relevance': .99})))

    def test_pipeline_wrong_identifier_is_a_handoff_even_with_high_semantic_score(self):
        text = 'รหัสสินค้า: INV-016 | ราคา_บาท: 800'
        doc = Document(page_content=text, metadata={'source': 'inventory.csv', 'semantic_relevance': .99})
        response = {'message': {'content': json.dumps({'answer': text, 'evidence_ids': [1]}, ensure_ascii=False)}}
        for question in self.questions:
            with self.subTest(question=question), patch.object(rag_pipeline, 'retrieve_docs', return_value=[doc]), patch.object(rag_pipeline, 'generate_answer', return_value=response):
                answer, sources = rag_pipeline.ask_rag(question, 'test')
                self.assertEqual(answer, 'REQUIRE_HUMAN_HANDOFF')
                self.assertEqual(sources, [])

    def test_pipeline_matching_identifier_remains_answerable_without_generation(self):
        doc = Document(page_content='รหัสสินค้า: inv-015 | ราคา_บาท: 745', metadata={'source': 'inventory.csv'})
        for question in self.questions:
            with self.subTest(question=question), patch.object(rag_pipeline, 'retrieve_docs', return_value=[doc]), patch.object(rag_pipeline, 'generate_answer', return_value={'message': {'content': '{"answer":"ไม่พบข้อมูล","evidence_ids":[]}'}}) as model:
                answer, sources = rag_pipeline.ask_rag(question, 'test')
                self.assertIn('745', answer)
                self.assertEqual(sources[0]['filename'], 'inventory.csv')
                model.assert_not_called()

    def test_current_thai_adjacent_identifier_overrides_history(self):
        history = [{'question': 'INV-002 เหลือกี่ชิ้น', 'answer': 'INV-999'}]
        question = 'แล้วสินค้าinv-015ราคาเท่าไร'
        self.assertEqual(build_retrieval_query(question, history), question)
        with patch('rag.semantic.rewrite_client', side_effect=RuntimeError('offline')):
            plan = prepare_query(question, history)
        self.assertEqual(plan.question, question)

    def test_followup_stops_at_latest_thai_adjacent_identifier(self):
        history = [{'question': 'INV-002 เหลือกี่ชิ้น'}, {'question': 'แล้วสินค้าinv-015ราคาเท่าไร', 'answer': 'INV-999'}]
        query = build_retrieval_query('แล้วเก็บอยู่ตรงไหน', history)
        self.assertNotIn('INV-002', query)
        self.assertIn('inv-015', query)
        with patch('rag.semantic.rewrite_client', side_effect=RuntimeError('offline')):
            plan = prepare_query('แล้วเก็บอยู่ตรงไหน', history)
        self.assertNotIn('INV-002', plan.question)
        self.assertNotIn('INV-999', plan.question)

    def test_factual_code_tokens_cover_thai_boundaries(self):
        self.assertIn('code:INV-015', _factual_tokens('สินค้าiNv-015ราคา 745 บาท'))

    def test_rewrite_cannot_change_thai_adjacent_mixed_case_identifier(self):
        question = 'สินค้าiNv-015มีอะไรบ้าง'
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value = {'message': {'content': json.dumps({'question': 'สินค้าABC-015มีอะไรบ้าง', 'queries': []}, ensure_ascii=False)}}
            plan = prepare_query(question)
        self.assertEqual(plan.queries, (question,))

    def test_rewrite_alternative_cannot_change_identifier(self):
        question = 'สินค้าINV-015มีอะไรบ้าง'
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value = {'message': {'content': json.dumps({'question': question, 'queries': ['สินค้าABC-015มีอะไรบ้าง']}, ensure_ascii=False)}}
            plan = prepare_query(question)
        self.assertEqual(plan.queries, (question,))

    def test_retriever_exact_record_handles_thai_adjacent_query(self):
        from rag.retriever import retrieve_docs

        class Store:
            def get(self, **kwargs):
                if kwargs.get('where_document') == {'$contains': 'INV-015'}:
                    return {'documents': ['รหัสสินค้า: INV-015 | ราคา_บาท: 745', 'รหัสสินค้า: INV-0150 | ราคา_บาท: 900'], 'metadatas': [{'source': 'inventory.csv'}, {'source': 'inventory.csv'}]}
                return {'documents': [], 'metadatas': []}

            def similarity_search_with_score(self, *args, **kwargs):
                return []

        with patch('api.knowledge.resolve_index_path', return_value='mock-index'), patch('rag.retriever.os.path.isfile', return_value=True), patch('rag.retriever.get_vector_db', return_value=Store()):
            docs = retrieve_docs('สินค้าinv-015ราคาเท่าไร', 'test', semantic=False)
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0].page_content, 'รหัสสินค้า: INV-015 | ราคา_บาท: 745')
