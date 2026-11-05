import unittest
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch
from langchain_core.documents import Document
from rag.chunker import split_documents
from rag.evidence import split_evidence_units, extract_section_answer, validate_grounded_answer

MENU = '''รายการอาหาร
หมวดหมู่: อาหารจานหลัก (Main Courses)
1. ข้าวกะเพรา
- ราคา: 60 บาท
- รายละเอียด: หมูสับ เฉพาะวันจันทร์
2. ผัดไทย
- ราคา: 80 บาท
- รายละเอียด: กุ้งสด
หมวดหมู่: ของหวาน (Desserts)
3. บัวลอย
- ราคา: 50 บาท
- รายละเอียด: กะทิ
'''


class CategoryTests(unittest.TestCase):
    def chunks(self, text=MENU, **metadata):
        return split_documents([Document(page_content=text, metadata={'source':'menu.txt', **metadata})])

    def test_complete_category_retains_items_prices_and_conditions(self):
        docs=[d for d in self.chunks() if d.metadata.get('category_overview') and 'อาหารจานหลัก' in d.metadata['section']]
        self.assertEqual(len(docs),1)
        answer=extract_section_answer('ขอรายละเอียดอาหารจานหลัก',split_evidence_units(docs))
        self.assertIsNotNone(answer)
        self.assertIn('60 บาท',answer.answer)
        self.assertIn('80 บาท',answer.answer)
        self.assertIn('เฉพาะวันจันทร์',answer.answer)
        self.assertNotIn('บัวลอย',answer.answer)
        self.assertTrue(validate_grounded_answer('ขอรายละเอียดอาหารจานหลัก',answer.answer,answer.evidence,split_evidence_units(docs))[0])

    def test_item_chunks_keep_parent_category(self):
        docs=[d for d in self.chunks() if not d.metadata.get('category_overview') and '80 บาท' in d.page_content]
        self.assertTrue(docs)
        self.assertTrue(all('หมวดหมู่: อาหารจานหลัก' in d.page_content for d in docs))
        self.assertFalse(any('ของหวาน' in d.page_content for d in docs))

    def test_oversized_or_paged_categories_do_not_claim_completeness(self):
        for docs in (self.chunks(MENU.replace('กุ้งสด','กุ้งสด '*1000)),self.chunks(page=1)):
            self.assertFalse(any(d.metadata.get('category_overview') and 'อาหารจานหลัก' in d.metadata['section'] for d in docs))

    def test_exact_lookup_skips_models_and_rejects_qualified_or_unknown_questions(self):
        from rag.retriever import _exact_category_documents
        docs=[d for d in self.chunks() if d.metadata.get('category_overview')]
        class Store:
            def get(self, **kwargs):
                return {'documents':[d.page_content for d in docs], 'metadatas':[d.metadata for d in docs]}
        store=Store()
        self.assertEqual(len(_exact_category_documents(store,'ขอรายละเอียดอาหารจานหลัก')),1)
        self.assertEqual(_exact_category_documents(store,'ขอรายละเอียดอาหารจานหลักราคาไม่เกิน 70 บาท'),[])
        self.assertEqual(_exact_category_documents(store,'ขอรายละเอียดเครื่องดื่ม'),[])
        docs.append(Document(page_content=docs[0].page_content,metadata={**docs[0].metadata,'source':'other.txt'}))
        self.assertEqual(_exact_category_documents(store,'ขอรายละเอียดอาหารจานหลัก'),[])

    def test_real_chroma_category_answers_without_models_and_stays_bot_scoped(self):
        script = r'''
import os, sys
os.environ['DATABASE_URL']='sqlite:///:memory:'
from pathlib import Path
from unittest.mock import patch
from langchain_core.embeddings import Embeddings
from langchain_chroma import Chroma
from rag.chunker import split_documents
from rag import retriever, semantic, rag_pipeline
from langchain_core.documents import Document
from test.test_category_retrieval import MENU
class LocalEmbedding(Embeddings):
    def embed_documents(self,texts): return [[1.,0.,0.] for _ in texts]
    def embed_query(self,text): raise AssertionError('Exact lookup must not embed')
root=Path(sys.argv[1])
for bot, text in [('a',MENU),('b','หมวดหมู่: เครื่องดื่ม\n1. ชา\nราคา: 20 บาท')]:
    Chroma.from_documents(split_documents([Document(page_content=text,metadata={'source':bot+'.txt'})]),embedding=LocalEmbedding(),persist_directory=str(root/bot))
with patch('api.knowledge.resolve_index_path',side_effect=lambda bot:root/bot), \
     patch.object(retriever,'get_embedding_model',side_effect=AssertionError('No model load')), \
     patch.object(semantic,'prepare_query',side_effect=AssertionError('No rewrite')), \
     patch.object(semantic,'rank_candidates',side_effect=AssertionError('No rerank')), \
     patch.object(rag_pipeline,'generate_answer',side_effect=AssertionError('No generation')):
    for question, expected, excluded in [('ขอรายละเอียดอาหารจานหลัก','80 บาท','บัวลอย'),('ขอรายละเอียดของหวาน','50 บาท','ผัดไทย'),('อาหารจานหลักมีอะไรบ้าง','60 บาท','บัวลอย')]:
        answer,sources=rag_pipeline.ask_rag(question,'a')
        assert expected in answer and excluded not in answer,answer
        assert sources[0]['filename']=='a.txt',sources
    other=retriever.get_vector_db('b',root/'b')
    assert retriever._exact_category_documents(other,'ขอรายละเอียดอาหารจานหลัก')==[]
print('Real Chroma: 3 grounded category answers, no model calls, bot isolation OK')
'''
        with tempfile.TemporaryDirectory() as temp:
            result=subprocess.run([sys.executable,'-c',script,temp],cwd=Path(__file__).resolve().parents[1],
                                  capture_output=True,text=True,encoding='utf-8',timeout=90,
                                  env={**os.environ,'PYTHONIOENCODING':'utf-8','ANONYMIZED_TELEMETRY':'False'})
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
