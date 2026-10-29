import unittest
from types import SimpleNamespace
from unittest.mock import patch


class IncrementalDeleteTests(unittest.TestCase):
    def test_ready_index_deletion_does_not_schedule_reembedding(self):
        from api.routers.documents import _sync_bot_knowledge_after_doc_change
        bot = SimpleNamespace(active_index_path='existing', knowledge_update_status='ready',
            indexed_revision=3, knowledge_revision=3, knowledge_blocked=False,
            documents=[object()], has_usable_knowledge=True, bot_id='bot', id=1)
        from fastapi import BackgroundTasks
        jobs = BackgroundTasks()
        with patch('rag.index_delete.delete_source') as delete:
            _sync_bot_knowledge_after_doc_change(bot, 'removed.csv', 1, jobs)
        delete.assert_called_once_with('existing', 'removed.csv')
        self.assertEqual(jobs.tasks, [])
        self.assertEqual(bot.indexed_revision, 4)
        self.assertFalse(bot.knowledge_blocked)

    def test_failed_delete_keeps_bot_blocked_and_schedules_rebuild(self):
        from api.routers.documents import _sync_bot_knowledge_after_doc_change
        from fastapi import BackgroundTasks
        bot = SimpleNamespace(active_index_path='existing', knowledge_update_status='ready',
            indexed_revision=3, knowledge_revision=3, knowledge_blocked=False,
            documents=[object()], has_usable_knowledge=True, bot_id='bot', id=1)
        jobs = BackgroundTasks()
        with patch('rag.index_delete.delete_source', side_effect=RuntimeError('offline')):
            _sync_bot_knowledge_after_doc_change(bot, 'removed.csv', 1, jobs)
        self.assertTrue(bot.knowledge_blocked)
        self.assertEqual(len(jobs.tasks), 1)

    def test_real_backends_remove_only_target_source_without_embeddings(self):
        import tempfile
        from pathlib import Path
        from langchain_core.documents import Document
        from langchain_core.embeddings import Embeddings
        from rag.index_delete import delete_source
        from rag.qdrant_store import build_qdrant, QdrantIndex
        from langchain_chroma import Chroma
        class LocalEmbedding(Embeddings):
            def embed_documents(self, texts): return [[1.0, 0.0] for _ in texts]
            def embed_query(self, text): return [1.0, 0.0]
        docs = [Document(page_content=name, metadata={'source': name}) for name in ['a.csv', 'b.docx']]
        # Chroma keeps native index handles until process exit on Windows.
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / 'tmp', ignore_cleanup_errors=True) as temp:
            root = Path(temp)
            embedding = LocalEmbedding()
            chroma = Chroma.from_documents(docs, embedding=embedding, persist_directory=str(root/'chroma'))
            with patch('config.QDRANT_URL', ''):
                build_qdrant(docs, root/'qdrant', embedding)
                with patch.object(embedding, 'embed_documents', side_effect=AssertionError('must not embed')):
                    delete_source(root/'chroma', 'a.csv')
                    delete_source(root/'qdrant', 'a.csv')
                self.assertEqual(chroma.get()['documents'], ['b.docx'])
                qdrant = QdrantIndex(root/'qdrant', embedding)
                self.assertEqual([d.page_content for d, _ in qdrant.similarity_search_with_score('query', 10)], ['b.docx'])
                # Repeated deletion is safe.
                delete_source(root/'qdrant', 'a.csv')
