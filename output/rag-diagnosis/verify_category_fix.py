import os,sys,json,time,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
os.environ['DATABASE_URL']='sqlite:///:memory:'
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_chroma import Chroma
from unittest.mock import patch
from rag.chunker import split_documents
from rag import rag_pipeline, retriever, semantic

class LocalEmbedding(Embeddings):
    def embed_documents(self,texts): return [[1.,0.,0.] for _ in texts]
    def embed_query(self,text): raise AssertionError('Exact lookup must not vector-search')

out=Path(__file__).parent
index=out/('verification-index-'+uuid.uuid4().hex)
text=Path('data/bot_bea29390/food_menu.txt').read_text(encoding='utf-8')
chunks=split_documents([Document(page_content=text,metadata={'source':'food_menu.txt'})])
Chroma.from_documents(chunks,embedding=LocalEmbedding(),persist_directory=str(index))
results=[]
with patch('api.knowledge.resolve_index_path',return_value=index), \
     patch.object(retriever,'get_embedding_model',side_effect=AssertionError('No embedding')), \
     patch.object(semantic,'prepare_query',side_effect=AssertionError('No rewriting')), \
     patch.object(semantic,'rank_candidates',side_effect=AssertionError('No reranking')), \
     patch.object(rag_pipeline,'generate_answer',side_effect=AssertionError('No generation')):
    for question in ['ขอรายละเอียดอาหารจานหลัก','ขอรายละเอียดของหวาน','ขอรายละเอียดเครื่องดื่ม']:
        start=time.perf_counter()
        answer,sources=rag_pipeline.ask_rag(question,'isolated-menu-test')
        result={'question':question,'answer':answer,'sources':sources,'seconds':round(time.perf_counter()-start,4)}
        assert sources and answer!='REQUIRE_HUMAN_HANDOFF',result
        if 'จานหลัก' in question:
            assert all(x in answer for x in ['ข้าวกะเพราหมูสับไข่ดาว','ผัดไทยกุ้งสด','ข้าวผัดปู','60 บาท','80 บาท','120 บาท'])
            assert 'แกงเขียวหวาน' not in answer and 'บัวลอย' not in answer
        results.append(result)
(out/'category-fix-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False),flush=True)
