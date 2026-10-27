"""Knowledge rebuilds must never destroy a serving index."""
import os
import subprocess
import sys
from threading import Thread, Event
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from api.database import Base
from api import models
from api.knowledge import request_update, run_update, state_lock, build_snapshot, resolve_index_path, resume_updates


class KnowledgeUpdateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / "tmp")
        self.root = Path(self.tmp.name)
        self.engine = create_engine("sqlite:///" + str(self.root / "app.db"))
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.db = self.sessions()
        user = models.User(email="test@example.test", username="test", hashed_password="unused")
        self.db.add(user)
        self.db.flush()
        source = self.root / "a.txt"
        source.write_text("Original knowledge", encoding="utf-8")
        self.bot = models.Bot(bot_id="bot_test", name="Test", owner_id=user.id, status=models.BotStatus.active)
        self.bot.documents.append(models.Document(filename="a.txt", file_path=str(source), owner_id=user.id))
        self.db.add(self.bot)
        self.db.commit()
        self.patches = [patch("api.knowledge.SessionLocal", self.sessions),
                        patch("api.knowledge.vector_root", return_value=self.root / "vectors")]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)
        logs = patch("api.knowledge.logger")
        logs.start()
        self.addCleanup(logs.stop)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.tmp.cleanup()

    def schedule(self, destructive=False):
        with state_lock():
            request_update(self.bot, destructive=destructive)
            self.db.commit()

    def run_job(self, builder):
        with patch("api.knowledge.build_snapshot", side_effect=builder):
            run_update(self.bot.bot_id, self.bot.id, "a.txt", self.bot.owner_id)
        self.db.expire_all()

    def test_addition_keeps_serving_while_queued_and_on_failure(self):
        self.schedule()
        self.assertTrue(self.bot.has_usable_knowledge)
        self.assertEqual(self.bot.knowledge_update_status, "queued")
        self.run_job(lambda *_: (_ for _ in ()).throw(RuntimeError("embedding failed")))
        self.assertTrue(self.bot.has_usable_knowledge)
        self.assertEqual(self.bot.knowledge_update_status, "error")
        self.assertIsNone(self.bot.active_index_path)

    def test_success_publishes_verified_snapshot_and_preserves_old_directory(self):
        old = self.root / "vectors" / self.bot.bot_id
        old.mkdir(parents=True)
        (old / "old-index").write_text("serving")
        self.schedule()
        def build(snapshot, output):
            self.assertEqual((snapshot / "a.txt").read_text(), "Original knowledge")
            self.assertTrue(self.bot.has_usable_knowledge)
            output.mkdir()
            (output / "chroma.sqlite3").write_text("verified")
        self.run_job(build)
        self.assertEqual(self.bot.knowledge_update_status, "ready")
        self.assertEqual(self.bot.indexed_revision, self.bot.knowledge_revision)
        self.assertTrue(Path(self.bot.active_index_path).is_dir())
        self.assertTrue((old / "old-index").exists())

    def test_destructive_failure_never_serves_removed_content(self):
        self.schedule(destructive=True)
        self.assertFalse(self.bot.has_usable_knowledge)
        self.run_job(lambda *_: (_ for _ in ()).throw(RuntimeError("failed")))
        self.assertFalse(self.bot.has_usable_knowledge)

    def test_new_bot_does_not_become_ready_on_timeout(self):
        self.bot.status = models.BotStatus.inactive
        self.db.commit()
        self.schedule()
        self.run_job(lambda *_: (_ for _ in ()).throw(TimeoutError("180 seconds")))
        self.assertFalse(self.bot.has_usable_knowledge)
        self.assertEqual(self.bot.knowledge_update_status, "error")

    def test_changed_revision_cannot_publish_old_result_and_rebuilds_latest(self):
        self.schedule()
        calls = []
        def build(snapshot, output):
            calls.append(output)
            output.mkdir()
            if len(calls) == 1:
                with self.sessions() as other:
                    bot = other.get(models.Bot, self.bot.id)
                    with state_lock():
                        request_update(bot)
                        other.commit()
        self.run_job(build)
        self.assertEqual(len(calls), 2)
        self.assertEqual(self.bot.active_index_path, str(calls[-1]))

    def test_deleted_bot_cannot_be_resurrected_by_late_result(self):
        self.schedule()
        bot_id, db_id, owner = self.bot.bot_id, self.bot.id, self.bot.owner_id
        def build(snapshot, output):
            output.mkdir()
            with self.sessions() as other:
                bot = other.get(models.Bot, db_id)
                bot.documents.clear()
                other.delete(bot)
                other.commit()
        with patch("api.knowledge.build_snapshot", side_effect=build):
            run_update(bot_id, db_id, "a.txt", owner)
        self.db.expire_all()
        self.assertIsNone(self.db.get(models.Bot, db_id))

    def test_legacy_path_and_new_pointer_use_the_same_readiness_check(self):
        self.assertEqual(resolve_index_path(self.bot.bot_id), self.root / "vectors" / self.bot.bot_id)
        self.bot.active_index_path = str(self.root / "published")
        self.db.commit()
        self.assertEqual(resolve_index_path(self.bot.bot_id), self.root / "published")
        self.schedule(destructive=True)
        self.assertIsNone(resolve_index_path(self.bot.bot_id))

    def test_worker_timeout_terminates_and_waits_before_returning(self):
        job = self.root / "job"
        job.mkdir()
        process = MagicMock()
        process.wait.side_effect = [subprocess.TimeoutExpired("test", 180),
                                    subprocess.TimeoutExpired("test", 5), 0]
        with patch("api.knowledge.subprocess.Popen", return_value=process):
            with self.assertRaises(TimeoutError):
                build_snapshot(job / "docs", job / "index")
        process.terminate.assert_called_once()
        process.kill.assert_called_once()
        self.assertEqual(process.wait.call_count, 3)

    def test_duplicate_jobs_do_not_rebuild_an_already_published_revision(self):
        self.schedule()
        calls = []
        def build(snapshot, output):
            calls.append(output)
            output.mkdir()
        self.run_job(build)
        self.run_job(build)
        self.assertEqual(len(calls), 1)

    def test_missing_new_file_keeps_old_index_and_reports_error(self):
        self.bot.documents.append(models.Document(filename="missing.txt", file_path=str(self.root / "missing"), owner_id=self.bot.owner_id))
        self.schedule()
        with patch("api.knowledge.build_snapshot") as build:
            run_update(self.bot.bot_id, self.bot.id, "missing.txt", self.bot.owner_id)
        build.assert_not_called()
        self.db.expire_all()
        self.assertTrue(self.bot.has_usable_knowledge)
        self.assertEqual(self.bot.knowledge_update_status, "error")

    def test_restart_resumes_queued_and_interrupted_updates(self):
        self.schedule()
        with patch("api.knowledge.Thread") as thread:
            resume_updates()
        thread.assert_called_once()
        thread.return_value.start.assert_called_once()

    def test_state_lock_excludes_another_process(self):
        with state_lock() as held:
            script = "from filelock import FileLock, Timeout; import sys\ntry:\n with FileLock(sys.argv[1], timeout=0): sys.exit(3)\nexcept Timeout: sys.exit(0)"
            result = subprocess.run([sys.executable, "-c", script, held.lock_file], timeout=15, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))

    def test_worker_forces_utf8_for_redirected_windows_output(self):
        job = self.root / "job"
        job.mkdir()
        with patch("api.knowledge.subprocess.Popen") as start:
            start.return_value.wait.return_value = 0
            build_snapshot(job / "docs", job / "index")
        self.assertEqual(start.call_args.kwargs.get("env", {}).get("PYTHONIOENCODING"), "utf-8")

    def test_qdrant_bot_dispatches_build_to_selected_backend(self):
        self.bot.vector_backend = "qdrant"
        self.db.commit()
        self.schedule()
        def build(snapshot, output, *, backend):
            self.assertEqual(backend, "qdrant")
            output.mkdir()
        self.run_job(build)
        self.assertEqual(self.bot.knowledge_update_status, "ready")
        self.assertTrue(self.bot.has_usable_knowledge)

    def test_concurrent_jobs_for_same_bot_only_build_one_at_a_time(self):
        self.schedule()
        entered, release = Event(), Event()
        failures, calls = [], []
        bot_id, db_id, owner = self.bot.bot_id, self.bot.id, self.bot.owner_id
        def build(snapshot, output):
            calls.append(output)
            entered.set()
            if not release.wait(10):
                raise AssertionError("Test did not release build")
            output.mkdir()
        def run():
            try:
                run_update(bot_id, db_id, "a.txt", owner)
            except Exception as exc:
                failures.append(exc)
        with patch("api.knowledge.build_snapshot", side_effect=build):
            first = Thread(target=run)
            second = Thread(target=run)
            first.start()
            try:
                self.assertTrue(entered.wait(10))
                second.start()
                # A new revision is committed while the first job holds the
                # build lock. Its old output must be discarded and coalesced.
                self.db.expire_all()
                self.schedule()
            finally:
                release.set()
                first.join(15)
                if second.ident is not None:
                    second.join(15)
        self.assertFalse(first.is_alive() or second.is_alive())
        self.assertEqual(failures, [])
        self.assertEqual(len(calls), 2)
        self.db.expire_all()
        self.assertEqual(self.bot.active_index_path, str(calls[-1]))


if __name__ == "__main__":
    unittest.main()
