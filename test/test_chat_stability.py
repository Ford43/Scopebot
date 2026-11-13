"""Chat liveness regressions; no external database, model or LINE requests."""
import asyncio
import os
import threading
import time
import types
import unittest
from unittest.mock import MagicMock, patch
from fastapi import BackgroundTasks

os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
from api.routers import line_webhook
from rag import rag_pipeline


class ChatStabilityTests(unittest.TestCase):
    def test_line_validation_runs_off_loop_and_does_not_delay_other_requests(self):
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
                background_tasks = BackgroundTasks()
                task = asyncio.create_task(line_webhook.line_webhook('bot', Request(), background_tasks))
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
                worker.assert_called_once_with('bot', b'{"events":[]}', 'signature', background_tasks)
        asyncio.run(scenario())

    def test_line_acknowledges_before_background_rag_and_closes_worker_sessions(self):
        async def scenario():
            loop_thread = threading.get_ident()
            session_threads = []
            bot = types.SimpleNamespace(
                id=7, is_line_connected=True, line_channel_secret='secret',
                line_channel_token='token', has_usable_knowledge=True, system_prompt=None,
            )
            session = types.SimpleNamespace(
                id=11, line_display_name='Customer', mode=line_webhook.models.SessionMode.bot,
            )
            databases = [MagicMock(), MagicMock()]
            for index, db in enumerate(databases):
                db.query.side_effect = lambda model: types.SimpleNamespace(
                    filter=lambda *args: types.SimpleNamespace(
                        first=lambda: bot if model is line_webhook.models.Bot else session,
                    ),
                )
                db.close.side_effect = lambda index=index: session_threads.append(
                    (index, 'close', threading.get_ident())
                )
            pending = iter(enumerate(databases))

            def session_factory():
                index, db = next(pending)
                session_threads.append((index, 'open', threading.get_ident()))
                return db

            class Request:
                headers = {'X-Line-Signature': 'signature'}
                async def body(self):
                    return b'{"events":[{"type":"message","replyToken":"reply","message":{"type":"text","text":"Policy question"},"source":{"userId":"line-user"}}]}'

            background_tasks = BackgroundTasks()
            with patch.object(line_webhook, 'SessionLocal', side_effect=session_factory), \
                 patch.object(line_webhook, '_verify_signature', return_value=True), \
                 patch.object(line_webhook, 'ApiClient'), \
                 patch.object(line_webhook, 'MessagingApi'), \
                 patch.object(line_webhook, '_show_line_loading'), \
                 patch.object(line_webhook, 'recent_bot_history', return_value=[]), \
                 patch.object(line_webhook, 'ask_rag', return_value=('Document answer', [])) as ask:
                result = await line_webhook.line_webhook('bot', Request(), background_tasks)
                self.assertEqual(result, {'status': 'ok'})
                ask.assert_not_called()
                databases[0].close.assert_called_once()
                databases[1].close.assert_not_called()

                await background_tasks()

                ask.assert_called_once_with('Policy question', 'bot', user_system_prompt=None, history=[])
            self.assertEqual(len(session_threads), 4)
            for index in range(2):
                opened, closed = [entry for entry in session_threads if entry[0] == index]
                self.assertEqual((opened[1], closed[1]), ('open', 'close'))
                self.assertEqual(opened[2], closed[2])
                self.assertNotEqual(opened[2], loop_thread)
                databases[index].close.assert_called_once()

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
                asyncio.run(line_webhook.line_webhook('bot', Request(), BackgroundTasks()))
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(len(threads), 2)
        self.assertEqual(threads[0], threads[1])
        self.assertNotEqual(threads[0], loop_thread)
