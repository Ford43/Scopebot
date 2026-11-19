"""Answer status and disconnected LINE handling, without outbound messages."""
import asyncio
import base64
import hashlib
import hmac
import json
import os
import unittest
from unittest.mock import patch

os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from api import models, schemas
from api.database import Base
from api.routers import chat, line_webhook, bots
from rag import rag_pipeline
from langchain_core.documents import Document


class AnswerStatusLineSetupTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', poolclass=StaticPool,
                                    connect_args={'check_same_thread': False})
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.addCleanup(self.db.close)
        self.user = models.User(email='setup@example.test', username='setup', hashed_password='unused')
        self.db.add(self.user)
        self.db.flush()
        self.bot = models.Bot(bot_id='bot_setup', name='Setup', owner_id=self.user.id,
                              status=models.BotStatus.active, is_line_connected=True,
                              line_channel_secret='secret', line_channel_token='token')
        self.bot.documents.append(models.Document(filename='guide.txt', file_path='unused', owner_id=self.user.id))
        self.db.add(self.bot)
        self.db.flush()
        self.db.add(models.LiveSession(bot_id=self.bot.id, line_user_id='customer', mode=models.SessionMode.bot))
        self.db.commit()
        self.answer = 'หากไม่พบข้อมูล ให้ตรวจสอบรหัสสินค้าอีกครั้ง'
        self.sources = [{'filename': 'guide.txt', 'snippet': self.answer}]
        self.body = json.dumps({'events': [{'type': 'message', 'replyToken': 'reply',
            'message': {'type': 'text', 'text': 'วิธีค้นหาสินค้า'}, 'source': {'userId': 'customer'}}]}).encode()
        self.signature = base64.b64encode(hmac.new(b'secret', self.body, hashlib.sha256).digest()).decode()

    def test_web_valid_answer_containing_no_data_keeps_citations(self):
        with patch.object(chat, 'ask_rag', return_value=(self.answer, self.sources)):
            result = chat.chat('bot_setup', schemas.ChatRequest(question='วิธีค้นหาสินค้า', session_id='web-test'), self.db, self.user)
        self.assertEqual(result['response_status'], 'answered')
        self.assertEqual(result['sources'], self.sources)
        self.assertFalse(result['offer_handoff'])

    def line(self, connected=True, signature=None, queued=False):
        self.bot.is_line_connected = connected
        self.db.commit()
        with patch.object(line_webhook, 'SessionLocal', self.Session), \
             patch.object(line_webhook, 'ApiClient'), \
             patch.object(line_webhook, 'MessagingApi') as messaging, \
             patch.object(line_webhook, '_show_line_loading'), \
             patch.object(line_webhook, 'ask_rag', return_value=(self.answer, self.sources)) as ask:
            tasks = BackgroundTasks() if queued else None
            result = line_webhook._process_line_webhook('bot_setup', self.body,
                         self.signature if signature is None else signature, tasks)
            if queued:
                self.assertFalse(messaging.called, 'acknowledgement must not wait for LINE')
                asyncio.run(tasks())
            return result, messaging.return_value, ask

    def test_line_valid_answer_containing_no_data_sends_text(self):
        _, messaging, _ = self.line()
        sent = messaging.reply_message.call_args.args[0].messages[0]
        self.assertEqual(sent.type, 'text')
        self.assertEqual(sent.text, self.answer)
        self.assertTrue(self.db.query(models.Conversation).one().is_answered_by_bot)

    def test_disabled_connection_replies_with_status_without_running_rag(self):
        result, messaging, ask = self.line(connected=False, queued=True)
        self.assertEqual(result, {'status': 'ok'})
        ask.assert_not_called()
        sent = messaging.reply_message.call_args.args[0].messages[0]
        self.assertEqual(sent.type, 'text')
        self.assertIn('ยังไม่พร้อม', sent.text)
        self.assertEqual(self.db.query(models.Conversation).count(), 0)

    def test_disabled_connection_still_rejects_invalid_signature(self):
        with self.assertRaises(HTTPException) as error:
            self.line(connected=False, signature='invalid')
        self.assertEqual(error.exception.status_code, 400)

    def test_enable_line_requires_both_credentials(self):
        self.bot.is_line_connected = False
        self.bot.line_channel_token = None
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            bots.toggle_line('bot_setup', self.db, self.user)
        self.assertEqual(error.exception.status_code, 400)
        self.assertFalse(self.bot.is_line_connected)

    def test_configured_connection_can_enable_and_missing_credentials_can_disable(self):
        self.bot.is_line_connected = False
        self.db.commit()
        self.assertTrue(bots.toggle_line('bot_setup', self.db, self.user)['is_line_connected'])
        self.bot.line_channel_secret = None
        self.db.commit()
        self.assertFalse(bots.toggle_line('bot_setup', self.db, self.user)['is_line_connected'])

    def test_disabled_connection_missing_credentials_does_not_send_unsigned_message(self):
        self.bot.is_line_connected = False
        self.bot.line_channel_secret = None
        self.db.commit()
        with patch.object(line_webhook, 'SessionLocal', self.Session), \
             patch.object(line_webhook, 'MessagingApi') as messaging:
            with self.assertRaises(HTTPException) as error:
                line_webhook._process_line_webhook('bot_setup', self.body, self.signature)
        self.assertEqual(error.exception.status_code, 400)
        messaging.assert_not_called()

    def test_real_no_answer_still_offers_handoff(self):
        with patch.object(chat, 'ask_rag', return_value=('REQUIRE_HUMAN_HANDOFF', [])):
            result = chat.chat('bot_setup', schemas.ChatRequest(question='ข้อมูลที่ไม่มี', session_id='web-test'), self.db, self.user)
        self.assertEqual(result['response_status'], 'unanswered')
        self.assertTrue(result['offer_handoff'])
        self.assertEqual(result['sources'], [])

    def test_grounded_model_answer_is_not_replaced_by_no_data_fallback(self):
        text = 'วิธีค้นหาสินค้า: ' + self.answer
        doc = Document(page_content=text, metadata={'source': 'guide.txt', 'semantic_relevance': .99})
        with patch.object(rag_pipeline, 'retrieve_docs', return_value=[doc]), \
             patch.object(rag_pipeline, 'generate_answer', return_value={'message': {'content': json.dumps({
                 'answer': text, 'evidence_ids': [1]})}}), \
             patch.object(rag_pipeline, 'extract_relevant_quote', return_value=None):
            answer, sources = rag_pipeline.ask_rag('วิธีค้นหาสินค้าทำอย่างไร', 'test')
        self.assertEqual(answer, text)
        self.assertEqual(sources[0]['filename'], 'guide.txt')
