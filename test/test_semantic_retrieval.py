import unittest
import json
from unittest.mock import patch, MagicMock
from langchain_core.documents import Document
from rag.semantic import prepare_query, rank_candidates


class SemanticRetrievalTests(unittest.TestCase):
    def test_rewrite_uses_context_but_keeps_original_query(self):
        response={'message':{'content':json.dumps({'question':'ระเบียบชุดปฏิบัติงานพนักงานมีอะไรบ้าง','queries':['การแต่งกาย ชุดปฏิบัติงาน']},ensure_ascii=False)}}
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value=response
            plan=prepare_query('แล้วต้องใส่อะไร', [{'question':'ชุดพนักงานมีกฎอย่างไร','answer':'do not trust this as document'}])
        self.assertIn('แล้วต้องใส่อะไร',plan.queries)
        self.assertIn('แล้วต้องใส่อะไร',plan.question)
        self.assertIn('ชุดพนักงานมีกฎอย่างไร',plan.question)

    def test_rewrite_failure_falls_back_and_new_numbers_are_rejected(self):
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.side_effect=RuntimeError('offline')
            plan=prepare_query('การแต่งตัว')
        self.assertEqual(plan.queries,('การแต่งตัว',))
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value={'message':{'content':'{"question":"เข้างาน 06:30","queries":[]}'}}
            plan=prepare_query('เข้างานกี่โมง')
        self.assertEqual(plan.question,'เข้างานกี่โมง')

    def test_cross_encoder_ranks_meaning_and_drops_unrelated(self):
        docs=[Document(page_content='กะเช้าเข้างาน 06:30'),Document(page_content='ชุดปฏิบัติงาน เสื้อเชิ้ตขาว')]
        with patch('rag.semantic.get_reranker') as model:
            model.return_value.predict.return_value=[0.05,0.92]
            ranked=rank_candidates('ระเบียบการแต่งตัว',docs)
        self.assertEqual(len(ranked),1)
        self.assertIn('เสื้อเชิ้ต',ranked[0].page_content)
        self.assertNotIn('semantic_relevance',docs[1].metadata)

    def test_reranker_failure_does_not_mark_unchecked_evidence_as_relevant(self):
        with patch('rag.semantic.get_reranker',side_effect=RuntimeError('unavailable')):
            with self.assertRaises(RuntimeError):
                rank_candidates('query',[Document(page_content='text')])

    def test_rewrite_cannot_change_explicit_shift(self):
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value={'message':{'content':'{"question":"กะบ่ายเข้างานกี่โมง","queries":[]}'}}
            plan=prepare_query('กะเช้าเข้างานกี่โมง')
        self.assertEqual(plan.question,'กะเช้าเข้างานกี่โมง')

    def test_generated_phrasing_cannot_replace_a_standalone_question(self):
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value={'message':{'content':'{"question":"การแต่งกายงาน formal","queries":["ชุดพนักงาน"]}'}}
            plan=prepare_query('ระเบียบการแต่งตัว')
        self.assertEqual(plan.question,'ระเบียบการแต่งตัว')

    def test_topic_change_does_not_inherit_previous_topic(self):
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value={'message':{'content':'{"question":"ข้อกำหนดชุดพนักงาน","queries":[]}'}}
            plan=prepare_query('วันเกิดได้อะไรบ้าง',[{'question':'ระเบียบชุดพนักงาน'}])
        self.assertEqual(plan.question,'วันเกิดได้อะไรบ้าง')

    def test_semantic_section_pipeline_preserves_page_citation(self):
        from rag import rag_pipeline
        doc=Document(page_content='1. ชุดปฏิบัติงาน\nเสื้อเชิ้ตขาว',metadata={'source':'manual.pdf','page':2,
            'section':'1. ชุดปฏิบัติงาน','evidence_unit':0,'semantic_relevance':0.95,
            'semantic_section_match':True,'resolved_question':'ระเบียบการแต่งตัว'})
        with patch.object(rag_pipeline,'retrieve_docs',return_value=[doc]):
            answer,sources=rag_pipeline.ask_rag('ระเบียบการแต่งตัว','test')
        self.assertIn('เสื้อเชิ้ตขาว',answer)
        self.assertEqual(sources[0]['page'],2)

    def test_contextual_rewrite_does_not_use_previous_answers_as_facts(self):
        with patch('rag.semantic.rewrite_client') as client:
            client.return_value.chat.return_value={'message':{'content':'{"question":"ข้อกำหนดรองเท้าพนักงาน","queries":[]}'}}
            plan=prepare_query('แล้วรองเท้าล่ะ',[{'question':'พนักงานแต่งตัวอย่างไร','answer':'SECRET_UNTRUSTED_ANSWER'}])
        prompt=str(client.return_value.chat.call_args.kwargs['messages'])
        self.assertNotIn('SECRET_UNTRUSTED_ANSWER',prompt)
        self.assertTrue(plan.question.startswith('แล้วรองเท้าล่ะ'))

    def test_semantic_evidence_accepts_paraphrases_but_preserves_citations(self):
        from rag.evidence import EvidenceUnit,select_evidence_units,validate_grounded_answer
        unit=EvidenceUnit('ชุดปฏิบัติงาน: เสื้อเชิ้ตขาว',{'semantic_relevance':0.95})
        selected=select_evidence_units('ระเบียบการแต่งตัว',[unit])
        self.assertEqual(selected,[unit])
        self.assertTrue(validate_grounded_answer('ระเบียบการแต่งตัว','เสื้อเชิ้ตขาว',[unit.text],selected)[0])
        self.assertFalse(validate_grounded_answer('ระเบียบการแต่งตัว','ราคา 999 บาท',[unit.text],selected)[0])

    def test_duplicate_candidate_keeps_best_distance_on_fallback(self):
        import tempfile
        from pathlib import Path
        from rag.retriever import retrieve_docs
        from rag.semantic import QueryPlan
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'tmp') as folder:
            path=Path(folder);(path/'chroma.sqlite3').touch()
            doc=Document(page_content='policy',metadata={'source':'a.txt'})
            store=MagicMock()
            store.similarity_search_with_score.side_effect=[[(doc,1.5)],[(doc,0.5)]]
            with patch('api.knowledge.resolve_index_path',return_value=path),patch('rag.retriever.get_vector_db',return_value=store),patch('rag.semantic.prepare_query',return_value=QueryPlan('policy',('first','second'))),patch('rag.semantic.rank_candidates',side_effect=RuntimeError('offline')):
                selected=retrieve_docs('first','bot',semantic=True)
        self.assertEqual(len(selected),1)
        self.assertNotIn('semantic_relevance',selected[0].metadata)
