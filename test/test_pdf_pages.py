"""Physical PDF page numbers survive ingestion and citations (one-based)."""
from api.native_runtime import prepare_native_runtime
prepare_native_runtime()
import tempfile
from pathlib import Path
import unittest
import os
import subprocess
import sys
import fitz
from langchain_core.documents import Document


class PdfPageTests(unittest.TestCase):
    def test_real_chroma_and_qdrant_store_physical_pages(self):
        root=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(dir=root/'tmp') as folder:
            script=r'''
from api.native_runtime import prepare_native_runtime
prepare_native_runtime()
import sys,fitz
from pathlib import Path
from langchain_core.embeddings import Embeddings
from rag.ingest import build_index
from rag.qdrant_store import QdrantIndex
from langchain_chroma import Chroma
class LocalEmbedding(Embeddings):
 def embed_documents(self,texts): return [[1.0,0.0] for t in texts]
 def embed_query(self,text): return [1.0,0.0]
root=Path(sys.argv[1]); docs=root/'docs'; docs.mkdir()
p=fitz.open(); p.new_page().insert_text((50,50),'1. Opening\n- First step'); p.new_page(); p.new_page().insert_text((50,50),'- Second step'); p.save(str(docs/'manual.pdf'));p.close()
embedding=LocalEmbedding()
for backend in ['chroma','qdrant']:
 output=root/backend
 build_index(docs,output,embedding=embedding,backend=backend)
 if backend=='chroma':
  store=Chroma(persist_directory=str(output),embedding_function=embedding)
  metadata=store.get()['metadatas']
 else:
  store=QdrantIndex(output,embedding)
  with store._connection() as c:
   points,_=c.scroll(collection_name=store.manifest['collection'],limit=10,with_payload=True)
  metadata=[p.payload['metadata'] for p in points]
 assert {m['page'] for m in metadata}=={1,3},metadata
 assert all(m['section']=='1. Opening' for m in metadata),metadata
 assert all(m['page_count']==3 for m in metadata),metadata
'''
            result=subprocess.run([sys.executable,'-c',script,folder],cwd=root,capture_output=True,timeout=90,
                env={**os.environ,'QDRANT_URL':'','PYTHONIOENCODING':'utf-8','ANONYMIZED_TELEMETRY':'False'})
            self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))

    def test_blank_pages_do_not_renumber_later_pages(self):
        from rag.document_loader import load_documents
        from rag.chunker import split_documents
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / 'tmp') as folder:
            pdf=fitz.open()
            pdf.new_page().insert_text((50,50),'1. Opening\n- Open the machine')
            pdf.new_page()
            pdf.new_page().insert_text((50,50),'2. Closing\n- Close the machine')
            pdf.save(str(Path(folder)/'manual.pdf'))
            pdf.close()
            docs=load_documents(data_path=folder,strict=True)
            self.assertEqual([d.metadata['page'] for d in docs],[1,3])
            self.assertTrue(all(d.metadata['page_count']==3 for d in docs))
            chunks=split_documents(docs)
            self.assertEqual({d.metadata['page'] for d in chunks},{1,3})

    def test_citations_keep_distinct_pages_and_deduplicate_same_page(self):
        from rag.rag_pipeline import extract_sources
        docs=[Document(page_content='Excerpt',metadata={'source':'manual.pdf','page':page}) for page in (1,1,3)]
        self.assertEqual([s['page'] for s in extract_sources(docs)],[1,3])

    def test_non_pdf_does_not_claim_a_page(self):
        from rag.rag_pipeline import extract_sources
        from api.schemas import ChatSource
        source=extract_sources([Document(page_content='text',metadata={'source':'a.txt'})])[0]
        self.assertIsNone(ChatSource(**source).page)

    def test_section_continues_across_pages_without_merging_page_numbers(self):
        from rag.chunker import split_documents
        chunks=split_documents([
            Document(page_content='1. Opening\n- First step',metadata={'source':'manual.pdf','page':1}),
            Document(page_content='- Second step',metadata={'source':'manual.pdf','page':2})])
        self.assertEqual([c.metadata['page'] for c in chunks],[1,2])
        self.assertEqual([c.metadata['section'] for c in chunks],['1. Opening','1. Opening'])
        self.assertLess(chunks[0].metadata['unit_order'],chunks[1].metadata['unit_order'])

    def test_heading_at_bottom_of_page_applies_to_next_page(self):
        from rag.chunker import split_documents
        chunks=split_documents([
            Document(page_content='1. Opening\n- Open machine\n2. Closing',metadata={'source':'manual.pdf','page':1}),
            Document(page_content='- Turn off machine',metadata={'source':'manual.pdf','page':2})])
        last=next(c for c in chunks if 'Turn off' in c.page_content)
        self.assertEqual(last.metadata['section'],'2. Closing')
        self.assertEqual(last.metadata['page'],2)
