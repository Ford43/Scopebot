"""Bangkok dashboard boundaries and password reset privacy, isolated SQLite."""
import os
import unittest
from datetime import date, datetime
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from api.database import Base
from api import models, schemas
from api.routers import dashboard, auth


class DashboardResetRegressionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = models.User(email="owner@example.com", username="owner", hashed_password="x", is_active=True, is_approved=True)
        self.db.add(self.user)
        self.db.flush()
        self.bot = models.Bot(bot_id="owned", name="Owned", owner_id=self.user.id)
        self.db.add(self.bot)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_dashboard_uses_bangkok_midnight_for_all_day_metrics(self):
        rows = [
            ("returning", datetime(2026, 11, 17, 16, 59, 59), "web"),
            ("returning", datetime(2026, 11, 17, 17), "web"),
            ("new", datetime(2026, 11, 18, 16, 59, 59), "line"),
            ("tomorrow", datetime(2026, 11, 18, 17), "line"),
        ]
        for sid, created, channel in rows:
            self.db.add(models.Conversation(bot_id=self.bot.id, session_id=sid, question="question", answer="answer", created_at=created, source_channel=channel))
        other = models.User(email="other@example.com", username="other", hashed_password="x")
        self.db.add(other)
        self.db.flush()
        other_bot = models.Bot(bot_id="other", name="Other", owner_id=other.id)
        self.db.add(other_bot)
        self.db.flush()
        for sid, created in [("new", datetime(2026, 11, 17, 10)), ("hidden", datetime(2026, 11, 18, 10))]:
            self.db.add(models.Conversation(bot_id=other_bot.id, session_id=sid, question="question", answer="answer", created_at=created))
        self.db.commit()
        with patch.object(dashboard, "_today", return_value=date(2026, 11, 18)):
            stats = dashboard.get_stats(days=2, scope="mine", db=self.db, current_user=self.user)
        self.assertEqual(stats["users"], {"new": 1, "returning": 1})
        self.assertEqual(stats["today_sessions"], 2)
        self.assertEqual(stats["daily_stats"], [
            {"date": "17/11", "total": 1, "line": 0, "web": 1},
            {"date": "18/11", "total": 2, "line": 1, "web": 1},
        ])

    def test_production_reset_response_does_not_reveal_account_or_delivery(self):
        with patch.object(auth, "_debug_mode", return_value=False):
            unknown = auth.forgot_password(schemas.ForgotPasswordRequest(email="missing@example.com"), db=self.db)
            for configured, sent in [(True, True), (True, False), (False, False)]:
                with self.subTest(configured=configured, sent=sent), patch.object(auth, "smtp_configured", return_value=configured), patch.object(auth, "send_password_reset_email", return_value=sent):
                    result = auth.forgot_password(schemas.ForgotPasswordRequest(email=self.user.email), db=self.db)
                    self.assertEqual(result, unknown)
                    self.assertEqual(set(result), {"message"})
            self.user.is_active = False
            self.db.commit()
            self.assertEqual(auth.forgot_password(schemas.ForgotPasswordRequest(email=self.user.email), db=self.db), unknown)

    def test_reset_fallback_does_not_log_raw_token(self):
        with patch.object(auth, "_debug_mode", return_value=False), patch.object(auth, "smtp_configured", return_value=False), patch.object(auth.secrets, "token_urlsafe", return_value="test-reset-secret"), self.assertLogs(auth.logger, level="WARNING") as captured:
            auth.forgot_password(schemas.ForgotPasswordRequest(email=self.user.email), db=self.db)
        self.assertNotIn("test-reset-secret", "\n".join(captured.output))

    def test_explicit_debug_mode_retains_local_reset_link(self):
        with patch.object(auth, "_debug_mode", return_value=True), patch.object(auth, "smtp_configured", return_value=False):
            result = auth.forgot_password(schemas.ForgotPasswordRequest(email=self.user.email), db=self.db)
        self.assertIn("/reset-password?token=", result["dev_reset_url"])
        self.assertFalse(result["email_sent"])


if __name__ == "__main__":
    unittest.main()

