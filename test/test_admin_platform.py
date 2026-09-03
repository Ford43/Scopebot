"""Admin platform overview and audit logs — isolated sqlite."""
from __future__ import annotations

import os
import tempfile
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")


class AdminPlatformTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.engine = create_engine(
            "sqlite:///" + os.path.join(self._tmp.name, "t.db"),
            connect_args={"check_same_thread": False},
        )
        from api.database import Base
        from api import models  # noqa: F401

        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.models = models

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self._tmp.cleanup()

    def _user(self, **kwargs):
        defaults = dict(
            email="a@x.com",
            username="alice",
            hashed_password="x",
            role=self.models.UserRole.user,
            is_approved=True,
            is_active=True,
        )
        defaults.update(kwargs)
        u = self.models.User(**defaults)
        self.db.add(u)
        self.db.commit()
        self.db.refresh(u)
        return u

    def test_write_audit_log_stores_actor_and_target(self):
        from api.audit import write_audit_log

        actor = self._user(email="admin@x.com", username="admin", role=self.models.UserRole.admin)
        target = self._user(email="shop@x.com", username="shop")

        write_audit_log(
            self.db,
            actor=actor,
            action="approve",
            target=target,
            detail="อนุมัติบัญชี shop",
        )

        row = self.db.query(self.models.AuditLog).one()
        self.assertEqual(row.action, "approve")
        self.assertEqual(row.actor_id, actor.id)
        self.assertEqual(row.actor_name, "admin")
        self.assertEqual(row.target_user_id, target.id)
        self.assertEqual(row.target_name, "shop")
        self.assertIn("อนุมัติ", row.detail)

    def test_system_overview_counts_every_tenant(self):
        from api.audit import build_system_overview

        admin = self._user(email="admin@x.com", username="admin", role=self.models.UserRole.admin)
        pending = self._user(email="p@x.com", username="pending", is_approved=False)
        banned = self._user(
            email="b@x.com", username="banned", is_active=False
        )
        shop = self._user(email="s@x.com", username="shop")

        bot = self.models.Bot(
            bot_id="bot_sys1",
            name="Shop Bot",
            owner_id=shop.id,
            status=self.models.BotStatus.active,
            is_line_connected=True,
        )
        self.db.add(bot)
        self.db.commit()

        stats = build_system_overview(self.db)
        self.assertEqual(stats["users"]["total"], 4)
        self.assertEqual(stats["users"]["pending"], 1)
        self.assertEqual(stats["users"]["banned"], 1)
        self.assertEqual(stats["users"]["admin"], 1)
        self.assertEqual(stats["bots"]["total"], 1)
        self.assertEqual(stats["bots"]["active"], 1)
        self.assertEqual(stats["bots"]["line_connected"], 1)
        self.assertEqual(stats["chats"]["waiting_queue"], 0)
        self.assertNotIn("questions", stats)
        self.assertIs(pending.is_approved, False)
        self.assertIs(banned.is_active, False)
        self.assertEqual(admin.role, self.models.UserRole.admin)


if __name__ == "__main__":
    unittest.main()
