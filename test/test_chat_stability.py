"""Chat liveness regressions; no external database, model or LINE requests."""
import asyncio
import os
import threading
import time
import unittest
from unittest.mock import patch

os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
from api.routers import line_webhook
from rag import rag_pipeline


class ChatStabilityTests(unittest.TestCase):
    def test_line_processing_runs_off_loop_and_does_not_delay_other_requests(self):
        async def scenario():
            loop_thread = threading.get_ident()
            threads = []
            started = threading.Event()
            release = threading.Event()

            def process(*args):
                threads.append(threading.get_ident())
                started.set()
                release.wait(2)
                return {'status': 'ok'}

            class Request:
                headers = {'X-Line-Signature': 'signature'}
                async def body(self):
                    return b'{"events":[]}'

            with patch.object(line_webhook, '_process_line_webhook', side_effect=process) as worker, \
                 patch.object(line_webhook, 'SessionLocal', side_effect=AssertionError('DB opened on event loop')):
                task = asyncio.create_task(line_webhook.line_webhook('bot', Request()))
                try:
                    deadline = time.monotonic() + 1
                    while not started.is_set() and not task.done() and time.monotonic() < deadline:
                        await asyncio.sleep(.005)
                    self.assertTrue(started.is_set(), 'webhook did not dispatch its blocking processing')
                    self.assertNotEqual(threads, [loop_thread])
                    self.assertFalse(task.done())
                finally:
                    release.set()
                    result = await asyncio.gather(task, return_exceptions=True)
                self.assertEqual(result, [{'status': 'ok'}])
                worker.assert_called_once_with('bot', b'{"events":[]}', 'signature')
        asyncio.run(scenario())

    def test_generation_uses_finite_timeout_and_closes_client(self):
        with patch.object(rag_pipeline.ollama, 'Client') as client:
            client.return_value.__enter__.return_value.chat.return_value = {'message': {'content': 'ok'}}
            # A regression to the old boundary must fail without calling a real model.
            with patch.object(rag_pipeline.ollama, 'chat', return_value={}):
                rag_pipeline.generate_answer(model='test', messages=[])
            self.assertTrue(client.called, 'generation still uses the unbounded default client')
            self.assertGreater(client.call_args.kwargs['timeout'], 0)
            client.return_value.__exit__.assert_called_once()

    def test_generation_timeout_is_reported_as_model_unavailable(self):
        from langchain_core.documents import Document
        import httpx
        doc = Document(page_content='นโยบายคืนสินค้า: ไม่รับคืนสินค้าทุกกรณี', metadata={'source': 'policy.txt', 'semantic_relevance': .99})
        with patch.object(rag_pipeline, 'retrieve_docs', return_value=[doc]), \
             patch.object(rag_pipeline, 'generate_answer', side_effect=httpx.ReadTimeout('timed out')):
            with self.assertRaises(rag_pipeline.RagUnavailableError):
                rag_pipeline.ask_rag('นโยบายคืนสินค้าเป็นอย่างไร', 'bot')

    def test_real_ollama_client_has_bounded_http_waits_and_closes_after_timeout(self):
        import httpx
        real_client = rag_pipeline.ollama.Client
        def stalled(request):
            self.assertGreater(request.extensions['timeout']['read'], 0)
            self.assertLessEqual(request.extensions['timeout']['read'], rag_pipeline.LLM_TIMEOUT_SEC)
            raise httpx.ReadTimeout('simulated stalled model', request=request)
        transport = httpx.MockTransport(stalled)
        client = real_client(timeout=rag_pipeline.LLM_TIMEOUT_SEC, transport=transport)
        with patch.object(rag_pipeline.ollama, 'Client', return_value=client):
            with self.assertRaises(httpx.ReadTimeout):
                rag_pipeline.generate_answer(model='test', messages=[])
        self.assertTrue(client._client.is_closed)

    def test_line_db_session_is_closed_in_its_worker_on_invalid_signature(self):
        from unittest.mock import MagicMock
        from fastapi import HTTPException
        threads = []
        db = MagicMock()
        def session_factory():
            threads.append(threading.get_ident())
            return db
        db.close.side_effect = lambda: threads.append(threading.get_ident())
        class Request:
            headers = {'X-Line-Signature': 'invalid'}
            async def body(self):
                return b'{"events":[]}'
        loop_thread = threading.get_ident()
        with patch.object(line_webhook, 'SessionLocal', side_effect=session_factory), \
             patch.object(line_webhook, '_verify_signature', return_value=False):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(line_webhook.line_webhook('bot', Request()))
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(len(threads), 2)
        self.assertEqual(threads[0], threads[1])
        self.assertNotEqual(threads[0], loop_thread)
