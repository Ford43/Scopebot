"""Reply delivery failure must never resolve or persist an unsent answer."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from api import models, auth
from api.database import Base, get_db
from api.routers.live_chat import router

class LiveDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.user = models.User(email="staff@example.test", username="staff", hashed_password="x", is_active=True, is_approved=True)
        self.db.add(self.user); self.db.flush()
        self.bot = models.Bot(bot_id="delivery", name="Delivery", owner_id=self.user.id, line_channel_token="fake-token")
        self.db.add(self.bot); self.db.flush()
        self.session = models.LiveSession(bot_id=self.bot.id, line_user_id="U" + "a" * 32, mode=models.SessionMode.waiting)
        self.db.add(self.session)
        self.question = models.Conversation(bot_id=self.bot.id, session_id=self.session.line_user_id, question="help", answer="", source_channel="line", is_answered_by_bot=False, is_resolved=False)
        self.db.add(self.question); self.db.commit()
        app=FastAPI(); app.include_router(router)
        app.dependency_overrides[get_db]=lambda:self.db
        app.dependency_overrides[auth.require_shop_operator]=lambda:self.user
        self.client=TestClient(app, raise_server_exceptions=False)
    def tearDown(self):
        self.client.close(); self.db.close(); self.engine.dispose()
    def reply(self):
        return self.client.post(f"/api/live/sessions/{self.session.id}/reply", json={"message":"answer"})
    def assert_unsent(self):
        self.db.expire_all()
        self.assertFalse(self.question.is_resolved)
        self.assertEqual(self.session.mode, models.SessionMode.waiting)
        self.assertEqual(self.db.query(models.LiveMessage).count(),0)
    def test_line_rejection_returns_error_and_preserves_queue(self):
        with patch("linebot.v3.messaging.MessagingApi.push_message", side_effect=RuntimeError("secret upstream error")):
            response=self.reply()
        self.assertEqual(response.status_code,502)
        self.assertNotIn("secret upstream", response.text)
        self.assert_unsent()
    def test_missing_line_credentials_does_not_claim_delivery(self):
        self.bot.line_channel_token=None; self.db.commit()
        response=self.reply()
        self.assertEqual(response.status_code,503)
        self.assert_unsent()
    def test_web_reply_skips_line_even_on_connected_bot(self):
        self.session.line_user_id="web-session"; self.question.session_id="web-session"; self.question.source_channel="web"; self.db.commit()
        with patch("linebot.v3.messaging.MessagingApi.push_message", side_effect=RuntimeError("must not push web")) as push:
            self.assertEqual(self.reply().status_code,200)
        push.assert_not_called()
        self.assertTrue(self.question.is_resolved)
    def test_line_success_persists_and_resolves(self):
        with patch("linebot.v3.messaging.MessagingApi.push_message"):
            self.assertEqual(self.reply().status_code,200)
        self.assertTrue(self.question.is_resolved)
        self.assertEqual(self.db.query(models.LiveMessage).one().message,"answer")
    def test_missing_sdk_returns_unavailable_without_resolving(self):
        import builtins
        original_import = builtins.__import__
        def without_sdk(name, *args, **kwargs):
            if name == "linebot.v3.messaging":
                raise ImportError("SDK unavailable")
            return original_import(name, *args, **kwargs)
        with patch("builtins.__import__", side_effect=without_sdk):
            self.assertEqual(self.reply().status_code, 503)
        self.assert_unsent()

    def test_end_still_closes_session_when_courtesy_notice_fails(self):
        with patch("linebot.v3.messaging.MessagingApi.push_message", side_effect=RuntimeError("unavailable")):
            response = self.client.post(f"/api/live/sessions/{self.session.id}/end")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.session.is_active)
        self.assertEqual(self.session.mode, models.SessionMode.bot)

    def test_line_handoff_without_history_requires_credentials(self):
        self.db.delete(self.question)
        self.bot.line_channel_token = None
        self.db.commit()
        self.assertEqual(self.reply().status_code, 503)
        self.assertEqual(self.db.query(models.LiveMessage).count(), 0)
