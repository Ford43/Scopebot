"""Library delete must detach bots, remove copies, and rebuild/clear vectors."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

from api import models
from api.routers import documents as documents_router


class FakeBackgroundTasks:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *args, **kwargs):
        self.tasks.append((fn, args, kwargs))


class FakeDocList(list):
    def remove(self, item):
        super().remove(item)


def _make_bot(bot_id: str, name: str, docs: list):
    bot = MagicMock()
    bot.bot_id = bot_id
    bot.id = abs(hash(bot_id)) % 10_000
    bot.name = name
    bot.status = models.BotStatus.active
    bot.documents = FakeDocList(docs)
    return bot


class LibraryDeleteTests(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self._tmp = tempfile.TemporaryDirectory()
        os.chdir(self._tmp.name)

    def tearDown(self):
        os.chdir(self._cwd)
        self._tmp.cleanup()

    def test_purge_last_document_clears_bot_copy_and_vectors(self):
        filename = "policy.txt"
        bot_id = "bot_hr"
        bot_dir = Path("data") / bot_id
        bot_dir.mkdir(parents=True)
        (bot_dir / filename).write_text("secret policy", encoding="utf-8")

        vec_dir = Path("vector_db") / bot_id
        vec_dir.mkdir(parents=True)
        (vec_dir / "chroma.sqlite3").write_text("stale-index", encoding="utf-8")

        doc = MagicMock()
        doc.filename = filename
        bot = _make_bot(bot_id, "HR Bot", [doc])
        doc.bots = [bot]

        bg = FakeBackgroundTasks()
        names = documents_router._purge_document_from_assigned_bots(
            doc, user_id=1, background_tasks=bg
        )

        self.assertEqual(names, ["HR Bot"])
        self.assertFalse((bot_dir / filename).exists())
        self.assertEqual(bot.status, models.BotStatus.inactive)
        self.assertNotIn(doc, bot.documents)
        self.assertEqual(len(bg.tasks), 1)
        fn, args, _kwargs = bg.tasks[0]
        self.assertIs(fn, documents_router._clear_bot_vectors)
        self.assertEqual(args[0], bot_id)

        fn(*args)
        self.assertFalse(vec_dir.exists())

    def test_purge_one_of_many_rebuilds_remaining_index(self):
        keep = MagicMock()
        keep.filename = "keep.txt"
        drop = MagicMock()
        drop.filename = "drop.txt"

        bot_id = "bot_sales"
        bot_dir = Path("data") / bot_id
        bot_dir.mkdir(parents=True)
        (bot_dir / "keep.txt").write_text("keep", encoding="utf-8")
        (bot_dir / "drop.txt").write_text("drop", encoding="utf-8")

        bot = _make_bot(bot_id, "Sales", [keep, drop])
        drop.bots = [bot]

        bg = FakeBackgroundTasks()
        documents_router._purge_document_from_assigned_bots(
            drop, user_id=7, background_tasks=bg
        )

        self.assertFalse((bot_dir / "drop.txt").exists())
        self.assertTrue((bot_dir / "keep.txt").exists())
        self.assertEqual(bot.status, models.BotStatus.processing)
        self.assertIn(keep, bot.documents)
        self.assertNotIn(drop, bot.documents)
        self.assertEqual(len(bg.tasks), 1)
        fn, args, _kwargs = bg.tasks[0]
        self.assertIs(fn, documents_router._run_ingest_and_notify)
        self.assertEqual(args[0], bot_id)
        self.assertEqual(args[2], "drop.txt")
        self.assertEqual(args[3], 7)


class LineWebhookCopyTests(unittest.TestCase):
    def test_does_not_send_searching_placeholder(self):
        src = (
            Path(documents_router.__file__).resolve().parents[1]
            / "routers"
            / "line_webhook.py"
        )
        text = src.read_text(encoding="utf-8")
        self.assertNotIn("กำลังหาข้อมูล", text)
        self.assertNotIn("RAG_WAIT_TEXT", text)


class HealEmptyKnowledgeTests(unittest.TestCase):
    def test_active_bot_without_docs_becomes_inactive(self):
        from api.routers.bots import heal_bot_without_knowledge

        bot = MagicMock()
        bot.status = models.BotStatus.active
        bot.documents = []
        db = MagicMock()

        out = heal_bot_without_knowledge(bot, db)

        self.assertEqual(out.status, models.BotStatus.inactive)
        db.commit.assert_called_once()

    def test_active_bot_with_docs_unchanged(self):
        from api.routers.bots import heal_bot_without_knowledge

        bot = MagicMock()
        bot.status = models.BotStatus.active
        bot.documents = [MagicMock()]
        db = MagicMock()

        out = heal_bot_without_knowledge(bot, db)

        self.assertEqual(out.status, models.BotStatus.active)
        db.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
