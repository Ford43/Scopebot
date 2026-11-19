"""Webhook acknowledgement must precede potentially slow LINE/RAG work."""
import base64
import hashlib
import hmac
import json
import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from test.test_review_fixes import rag_pipeline  # Import with external retrieval stubbed.
from api.routers import line_webhook


class LineWebhookTimeoutTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, signature_valid=True, connected=True):
        app = FastAPI()
        app.include_router(line_webhook.router)
        body = json.dumps({"events": [{"type": "message", "message": {
            "type": "text", "text": "question"}, "replyToken": "reply",
            "source": {"userId": "customer"}}]}).encode()
        signature = base64.b64encode(hmac.new(b"secret", body, hashlib.sha256).digest())
        db = MagicMock()
        bot = db.query.return_value.filter.return_value.first.return_value
        bot.line_channel_secret = "secret"
        bot.line_channel_token = "token"
        bot.is_line_connected = connected
        messages = []
        work = []

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(message):
            messages.append(message)

        def slow_work(*args, **kwargs):
            # At this boundary, profile lookup/RAG/LINE calls may take arbitrarily long.
            work.append(any(m["type"] == "http.response.body" for m in messages))
            raise RuntimeError("simulated downstream failure")

        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
                 "method": "POST", "scheme": "http", "path": "/api/line/webhook/bot_test",
                 "query_string": b"", "headers": [(b"x-line-signature", signature if signature_valid else b"bad")],
                 "server": ("test", 80), "client": ("test", 123)}
        with patch.object(line_webhook, "SessionLocal", return_value=db), \
             patch.object(line_webhook, "Configuration", side_effect=slow_work):
            await app(scope, receive, send)
        return messages[0]["status"], work

    async def test_response_is_sent_before_slow_processing_even_when_processing_fails(self):
        status, work = await self.request()
        self.assertEqual(status, 200)
        self.assertEqual(work, [True])

    async def test_invalid_signature_rejected_before_processing(self):
        status, work = await self.request(signature_valid=False)
        self.assertEqual(status, 400)
        self.assertEqual(work, [])

    async def test_disconnected_bot_acknowledges_before_sending_unavailable_notice(self):
        status, work = await self.request(connected=False)
        self.assertEqual(status, 200)
        self.assertEqual(work, [True])
