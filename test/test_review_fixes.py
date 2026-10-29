"""Regression coverage for the six reviewed issues; no real DB, LLM or LINE calls."""
import asyncio
import io
import json
import os
import sys
import tempfile
import types
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, mock_open, MagicMock

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from api import auth, models, schemas
from api.database import Base, get_db

# Loading the real retriever initializes a downloaded embedding model. Replace
# only this external boundary while importing the real RAG and HTTP handlers.
retriever_stub = types.ModuleType("rag.retriever")
retriever_stub.retrieve_docs = lambda *a, **kw: []
previous_retriever = sys.modules.get("rag.retriever")
sys.modules["rag.retriever"] = retriever_stub
try:
    from api.routers import chat, documents, live_chat
    from rag import rag_pipeline
finally:
    if previous_retriever is None:
        sys.modules.pop("rag.retriever", None)
    else:
        sys.modules["rag.retriever"] = previous_retriever


class ReviewFixTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.user = models.User(email="owner@example.test", username="owner", hashed_password="unused", is_active=True, is_approved=True)
        self.db.add(self.user)
        self.db.flush()
        self.bot = models.Bot(bot_id="bot_review", name="Review", owner_id=self.user.id, status=models.BotStatus.active)
        self.doc = models.Document(filename="policy.txt", file_path="unused", owner_id=self.user.id)
        self.bot.documents.append(self.doc)
        self.db.add(self.bot)
        self.db.commit()
        self.tmp = tempfile.TemporaryDirectory()
        self.old_cwd = os.getcwd()
        os.chdir(self.tmp.name)
        self.addCleanup(os.chdir, self.old_cwd)
        self.upload_base = patch.object(documents, "UPLOAD_BASE", str(Path(self.tmp.name) / "library"))
        self.upload_base.start()
        self.addCleanup(self.upload_base.stop)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        os.chdir(self.old_cwd)
        self.tmp.cleanup()

    def send(self, question, session="web-session"):
        return chat.chat(self.bot.bot_id, schemas.ChatRequest(question=question, session_id=session), self.db, self.user)

    def history(self, **kwargs):
        return chat.get_all_sessions(page=1, limit=20, bot_id_filter=self.bot.bot_id, scope="mine", db=self.db, current_user=self.user, **kwargs)

    def upload(self, filename, content, **kwargs):
        bg = BackgroundTasks()
        result = asyncio.run(documents.upload_document(background_tasks=bg, file=UploadFile(filename=filename, file=io.BytesIO(content)), category="test", db=self.db, current_user=self.user, **kwargs))
        return result, bg

    def test_banned_account_rejects_existing_token_on_protected_routes(self):
        token = auth.create_access_token({"sub": str(self.user.id)})
        self.user.is_active = False
        self.db.commit()
        app = FastAPI()
        app.include_router(chat.router)
        app.dependency_overrides[get_db] = lambda: self.db
        with TestClient(app) as client:
            result = client.get("/api/chat/sessions/all", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(result.status_code, 403)

    def test_upload_rejects_paths_before_writing(self):
        for name in ("../escape.txt", "..\\escape.txt", "/escape.txt", "C:\\escape.txt", "C:escape.txt", "sub/file.txt"):
            with self.subTest(name=name):
                # Never let deliberately malicious test names touch the host.
                with patch("builtins.open", mock_open()), patch.object(documents.os, "makedirs"):
                    with self.assertRaises(HTTPException) as error:
                        self.upload(name, b"payload")
                self.assertEqual(error.exception.status_code, 400)

    def test_duplicate_upload_requires_explicit_replacement(self):
        original, _ = self.upload("manual.txt", b"old")
        with self.assertRaises(HTTPException) as error:
            self.upload("manual.txt", b"new")
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(Path(original.file_path).read_bytes(), b"old")

    def test_first_upload_locks_owner_before_checking_duplicate_name(self):
        # SQLite cannot exercise PostgreSQL row locks, but this checks the SQL
        # issued by the real upload flow, including the initially absent name.
        statements = []
        def capture(_conn, statement, *_args):
            statements.append(str(statement.compile(dialect=postgresql.dialect())))
        event.listen(self.engine, "before_execute", capture)
        try:
            self.upload("first-upload.txt", b"content")
        finally:
            event.remove(self.engine, "before_execute", capture)
        doc_read = next(i for i, sql in enumerate(statements) if "FROM documents" in sql)
        self.assertTrue(any("FROM users" in sql and "FOR UPDATE" in sql for sql in statements[:doc_read]),
                        "Lock the existing owner row before checking a document name that may not exist yet")

    def test_upload_http_form_requires_and_accepts_explicit_replacement(self):
        app = FastAPI()
        app.include_router(documents.router)
        app.dependency_overrides[get_db] = lambda: self.db
        headers = {"Authorization": f"Bearer {auth.create_access_token({'sub': str(self.user.id)})}"}
        with TestClient(app) as client:
            first = client.post("/api/documents/upload", headers=headers,
                                files={"file": ("wire.txt", b"old", "text/plain")})
            self.assertEqual(first.status_code, 200)
            conflict = client.post("/api/documents/upload", headers=headers,
                                   files={"file": ("wire.txt", b"new", "text/plain")},
                                   data={"replace_existing": "false"})
            self.assertEqual(conflict.status_code, 409)
            replaced = client.post("/api/documents/upload", headers=headers,
                                   files={"file": ("wire.txt", b"new", "text/plain")},
                                   data={"replace_existing": "true"})
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(first.json()["id"], replaced.json()["id"])
        saved = self.db.query(models.Document).filter_by(filename="wire.txt").one()
        self.assertEqual(Path(saved.file_path).read_bytes(), b"new")

    def test_replacement_updates_all_assigned_copies_and_schedules_reindex(self):
        original, _ = self.upload("manual.txt", b"old")
        other = models.Bot(bot_id="bot_other", name="Other", owner_id=self.user.id, status=models.BotStatus.active)
        self.db.add(other)
        for bot in (self.bot, other):
            bot.documents.append(original)
            folder = Path("data") / bot.bot_id
            folder.mkdir(parents=True)
            (folder / original.filename).write_bytes(b"old")
        self.db.commit()
        import inspect
        self.assertIn("replace_existing", inspect.signature(documents.upload_document).parameters)
        updated, bg = self.upload("manual.txt", b"new policy", replace_existing=True)
        self.assertEqual(updated.id, original.id)
        self.assertEqual(Path(updated.file_path).read_bytes(), b"new policy")
        self.assertEqual(updated.file_size, len(b"new policy"))
        for bot in (self.bot, other):
            self.assertEqual((Path("data") / bot.bot_id / updated.filename).read_bytes(), b"new policy")
            self.assertEqual(bot.status, models.BotStatus.processing)
        jobs = [t for t in bg.tasks if t.func is documents._run_ingest_and_notify]
        self.assertEqual({t.args[0] for t in jobs}, {self.bot.bot_id, other.bot_id})

    def test_staff_reply_is_available_after_session_ends(self):
        self.send("ติดต่อเจ้าหน้าที่")
        session = self.db.query(models.LiveSession).one()
        live_chat.staff_reply(session.id, schemas.StaffReply(message="Final answer"), self.db, self.user)
        live_chat.end_session(session.id, self.db, self.user)
        result = chat.get_session_updates(self.bot.bot_id, "web-session", self.db, self.user)
        self.assertEqual([m["message"] for m in result["messages"]], ["Final answer"])
        self.assertEqual(result["mode"], "bot")

    def test_human_only_chat_is_in_history_with_all_messages(self):
        self.send("ติดต่อเจ้าหน้าที่")
        self.send("Please help")
        session = self.db.query(models.LiveSession).one()
        live_chat.staff_reply(session.id, schemas.StaffReply(message="I can help"), self.db, self.user)
        live_chat.end_session(session.id, self.db, self.user)
        rows = self.history()
        self.assertEqual(len(rows), 1)
        self.assertEqual([m["text"] for m in rows[0]["timeline"]], ["ติดต่อเจ้าหน้าที่", "Please help", "I can help"])
        self.assertEqual([m["sender"] for m in rows[0]["timeline"]], ["user", "user", "staff"])

    def test_staff_reply_preserves_original_bot_answer(self):
        with patch.object(chat, "ask_rag", return_value=("REQUIRE_HUMAN_HANDOFF", [])):
            result = self.send("Policy question")
        original_answer = result["answer"]
        self.send("ติดต่อเจ้าหน้าที่")
        session = self.db.query(models.LiveSession).one()
        live_chat.staff_reply(session.id, schemas.StaffReply(message="Staff answer"), self.db, self.user)
        self.assertEqual(self.db.query(models.Conversation).one().answer, original_answer)
        timeline = self.history()[0]["timeline"]
        self.assertEqual(sum(m["text"] == "Staff answer" for m in timeline), 1)

    def test_web_grounding_rejection_offers_handoff(self):
        with patch.object(chat, "ask_rag", return_value=("REQUIRE_HUMAN_HANDOFF", [])):
            result = self.send("Unknown policy question")

        self.assertFalse(result["is_answered_by_bot"])
        self.assertTrue(result["offer_handoff"])
        self.assertEqual(result["response_status"], "unanswered")

    def test_line_transcript_does_not_duplicate_conversation_and_live_messages(self):
        session = models.LiveSession(line_user_id="U-line", line_display_name="Customer", bot_id=self.bot.id, mode=models.SessionMode.bot)
        self.db.add(session)
        self.db.flush()
        for sender, text in ((models.SenderType.customer, "Question"), (models.SenderType.bot, "Answer")):
            self.db.add(models.LiveMessage(session_id=session.id, sender_type=sender, message=text))
        self.db.add(models.Conversation(bot_id=self.bot.id, session_id="U-line", question="Question", answer="Answer", source_channel="line", is_answered_by_bot=True))
        self.db.commit()
        rows = self.history()
        self.assertEqual([m["text"] for m in rows[0].get("timeline", [])], ["Question", "Answer"])

    def test_followup_receives_only_same_bot_session_history(self):
        self.db.add_all([
            models.Conversation(bot_id=self.bot.id, session_id="web-session", question="Annual leave policy", answer="Ten days", is_answered_by_bot=True),
            models.Conversation(bot_id=self.bot.id, session_id="another-session", question="Secret other session", answer="Private", is_answered_by_bot=True),
        ])
        self.db.commit()
        def answer_from_context(question, bot_id, **kwargs):
            turns = kwargs.get("history") or []
            return ("Correct context" if [t["question"] for t in turns] == ["Annual leave policy"] else "Missing or leaked context", [])
        with patch.object(chat, "ask_rag", side_effect=answer_from_context):
            self.assertEqual(self.send("What documents do I need?")["answer"], "Correct context")

    def test_retrieval_uses_followup_context(self):
        doc = types.SimpleNamespace(page_content="Annual leave requires a leave form", metadata={"source": "policy.txt"})
        def retrieve(query, bot, **kwargs):
            return [doc] if "Annual leave" in query else []
        grounded = json.dumps({
            "answer": "A leave form",
            "evidence": ["Annual leave requires a leave form"],
        })
        with patch.object(rag_pipeline, "retrieve_docs", side_effect=retrieve), patch.object(rag_pipeline.ollama, "chat", return_value={"message": {"content": grounded}}):
            answer, _ = rag_pipeline.ask_rag("What documents?", self.bot.bot_id, history=[{"question": "Annual leave", "answer": "Ten days"}])
        self.assertEqual(answer, "A leave form")

    def test_model_failure_is_not_counted_as_a_success(self):
        doc = types.SimpleNamespace(page_content="Policy", metadata={"source": "policy.txt"})
        with patch.object(rag_pipeline, "retrieve_docs", return_value=[doc]), patch.object(rag_pipeline.ollama, "chat", side_effect=ConnectionError("offline")):
            result = self.send("What is the policy?")
        self.assertFalse(result["is_answered_by_bot"])
        self.assertEqual(result.get("response_status"), "error")
        row = self.db.query(models.Conversation).one()
        self.assertFalse(row.is_resolved)
        self.assertEqual(self.db.query(models.LiveSession).count(), 0)

    def test_retrieval_failure_returns_a_controlled_error(self):
        with patch.object(rag_pipeline, "retrieve_docs", side_effect=RuntimeError("vector store unavailable")):
            try:
                result = self.send("What is the policy?")
            except RuntimeError:
                self.fail("Retrieval failure escaped as an unhandled server error")
        self.assertEqual(result.get("response_status"), "error")
        self.assertFalse(result["is_answered_by_bot"])

    def test_repeated_handoff_keeps_all_staff_replies(self):
        for text in ("First answer", "Second answer"):
            self.send("ติดต่อเจ้าหน้าที่")
            session = self.db.query(models.LiveSession).filter_by(is_active=True).one()
            live_chat.staff_reply(session.id, schemas.StaffReply(message=text), self.db, self.user)
            live_chat.end_session(session.id, self.db, self.user)
        result = chat.get_session_updates(self.bot.bot_id, "web-session", self.db, self.user)
        self.assertEqual([m["message"] for m in result["messages"]], ["First answer", "Second answer"])
        rows = self.history()
        self.assertEqual(len(rows), 1)
        self.assertEqual([m["text"] for m in rows[0]["timeline"] if m["sender"] == "staff"], ["First answer", "Second answer"])

    def test_history_never_includes_another_owners_live_sessions(self):
        other = models.User(email="other@example.test", username="other", hashed_password="unused", is_approved=True)
        self.db.add(other)
        self.db.flush()
        bot = models.Bot(bot_id="bot_private", name="Private", owner_id=other.id)
        self.db.add(bot)
        self.db.flush()
        session = models.LiveSession(bot_id=bot.id, line_user_id="private", line_display_name="Private")
        self.db.add(session)
        self.db.flush()
        self.db.add(models.LiveMessage(session_id=session.id, sender_type=models.SenderType.customer, message="Private content"))
        self.db.commit()
        result = chat.get_all_sessions(db=self.db, current_user=self.user)
        self.assertEqual(result, [])

    def test_context_is_bounded_and_excludes_other_bot_and_failed_answers(self):
        from api.chat_history import recent_bot_history
        other = models.Bot(bot_id="bot_context_other", name="Other", owner_id=self.user.id)
        self.db.add(other)
        self.db.flush()
        for i in range(9):
            self.db.add(models.Conversation(bot_id=self.bot.id, session_id="same", question=f"Question {i}", answer="Answer", is_answered_by_bot=True))
        self.db.add_all([
            models.Conversation(bot_id=other.id, session_id="same", question="Wrong bot", answer="Private", is_answered_by_bot=True),
            models.Conversation(bot_id=self.bot.id, session_id="same", question="Failed", answer="Error", is_answered_by_bot=False),
        ])
        self.db.commit()
        history = recent_bot_history(self.db, self.bot.id, "same", "web")
        self.assertEqual([t["question"] for t in history], [f"Question {i}" for i in range(3, 9)])

    def test_assigning_replaced_document_again_is_idempotent(self):
        bg = BackgroundTasks()
        result = documents.assign_to_bot(self.doc.id, self.bot.bot_id, bg, self.db, self.user)
        self.assertIn("message", result)
        self.assertEqual(len(self.bot.documents), 1)
        self.assertEqual(len(bg.tasks), 0)

    def test_adding_file_keeps_existing_bot_available_for_web_chat(self):
        from api.knowledge import state_lock, request_update
        with state_lock():
            request_update(self.bot)
            self.db.commit()
        with patch.object(chat, "ask_rag", return_value=("Original answer", [])) as ask:
            result = self.send("What is the policy?")
        self.assertEqual(result["answer"], "Original answer")
        ask.assert_called_once()
        self.assertTrue(schemas.BotOut.model_validate(self.bot).has_usable_knowledge)
        self.assertEqual(self.bot.knowledge_update_status, "queued")

    def test_create_backend_choice_is_persisted_and_cannot_change_later(self):
        from api.routers import bots
        trial = bots.create_bot(schemas.BotCreate(name="Qdrant trial", vector_backend="qdrant"), self.db, self.user)
        self.assertEqual(trial.vector_backend, "qdrant")
        self.assertEqual(schemas.BotOut.model_validate(trial).vector_backend, "qdrant")
        with self.assertRaises(HTTPException) as error:
            bots.update_bot(trial.bot_id, schemas.BotUpdate(vector_backend="chroma"), self.db, self.user)
        self.assertEqual(error.exception.status_code, 400)
        self.db.refresh(trial)
        self.assertEqual(trial.vector_backend, "qdrant")
        # Older clients that omit the choice still get the original backend.
        self.assertEqual(self.bot.vector_backend, "chroma")

    def test_reusing_library_document_for_qdrant_does_not_rebuild_chroma_bot(self):
        from api.routers import bots
        doc, _ = self.upload("shared.txt", b"shared knowledge")
        documents.assign_to_bot(doc.id, self.bot.bot_id, BackgroundTasks(), self.db, self.user)
        first_revision = self.bot.knowledge_revision
        trial = bots.create_bot(schemas.BotCreate(name="Qdrant trial", vector_backend="qdrant"), self.db, self.user)
        documents.assign_to_bot(doc.id, trial.bot_id, BackgroundTasks(), self.db, self.user)
        self.db.refresh(self.bot)
        self.assertEqual(self.bot.knowledge_revision, first_revision)
        self.assertTrue(self.bot.has_usable_knowledge)
        self.assertEqual(Path(doc.file_path).read_bytes(), b"shared knowledge")
        self.assertEqual({bot.id for bot in doc.bots}, {self.bot.id, trial.id})

    def test_destructive_update_blocks_web_chat_until_success(self):
        from api.knowledge import state_lock, request_update
        with state_lock():
            request_update(self.bot, destructive=True)
            self.db.commit()
        with patch.object(chat, "ask_rag") as ask:
            with self.assertRaises(HTTPException):
                self.send("What is the policy?")
        ask.assert_not_called()

    def test_account_delete_revokes_index_without_removing_open_files(self):
        from api.routers import auth as auth_router
        from api.knowledge import resolve_index_path
        admin = models.User(email="admin-delete@example.test", username="admin-delete",
                            hashed_password="unused", role=models.UserRole.admin,
                            is_active=True, is_approved=True)
        self.db.add(admin)
        self.user.is_active = False
        self.db.commit()
        bot_id, db_id = self.bot.bot_id, self.bot.id
        index = Path("vector_db") / bot_id
        index.mkdir(parents=True)
        marker = index / "open-index"
        marker.write_text("old index")
        auth_router.delete_user(self.user.id, self.db, admin)
        self.assertIsNone(self.db.get(models.Bot, db_id))
        self.assertTrue(marker.exists())
        with patch("api.knowledge.SessionLocal", return_value=self.db):
            self.assertIsNone(resolve_index_path(bot_id))

    def test_line_answers_during_additive_update_but_blocks_destructive_update(self):
        from api.knowledge import state_lock, request_update
        from api.routers import line_webhook
        self.bot.is_line_connected = True
        self.bot.line_channel_token = "test-token"
        self.bot.line_channel_secret = "test-secret"
        self.db.commit()
        app = FastAPI()
        app.include_router(line_webhook.router)
        db_id = self.bot.id
        for destructive in (False, True):
            with self.subTest(destructive=destructive):
                self.bot = self.db.get(models.Bot, db_id)
                with state_lock():
                    request_update(self.bot, destructive=destructive)
                    self.db.commit()
                with patch.object(line_webhook, "SessionLocal", return_value=self.db), \
                     patch.object(line_webhook, "_verify_signature", return_value=True), \
                     patch.object(line_webhook, "_get_display_name", return_value="Customer"), \
                     patch.object(line_webhook, "_show_line_loading"), \
                     patch.object(line_webhook, "ApiClient"), \
                     patch.object(line_webhook, "MessagingApi"), \
                     patch.object(line_webhook, "_line_reply_or_push") as send, \
                     patch.object(line_webhook, "ask_rag", return_value=("Original answer", [])) as ask:
                    with TestClient(app) as client:
                        result = client.post(f"/api/line/webhook/{self.bot.bot_id}", json={"events": [{
                            "type": "message", "replyToken": "reply", "message": {"type": "text", "text": "Policy question"},
                            "source": {"userId": "Utest"}}]})
                self.assertEqual(result.status_code, 200)
                self.assertEqual(ask.call_count, 0 if destructive else 1)
                if not destructive:
                    self.assertEqual(send.call_args.args[3][0].text, "Original answer")

    def test_legacy_filename_can_be_detached_without_new_upload_validation(self):
        # Such names were accepted on Linux by the previous uploader. A missing
        # local copy (e.g. after restoring on Windows) must not trap the record.
        self.doc.filename = "policy:2025.pdf"
        self.db.commit()
        with patch.object(documents.os.path, "exists", return_value=False):
            result = documents.unassign_from_bot(self.doc.id, self.bot.bot_id, BackgroundTasks(), self.db, self.user)
        self.assertIn("message", result)
        self.assertNotIn(self.doc, self.bot.documents)

    def test_persisted_filename_cannot_delete_outside_bot_folder(self):
        root = Path(self.tmp.name)
        target = root / "data" / "outside.txt"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"keep")
        with self.assertRaises(HTTPException):
            documents._remove_bot_copy(self.bot.bot_id, "../outside.txt")
        self.assertEqual(target.read_bytes(), b"keep")

    def test_oversize_replacement_preserves_previous_content(self):
        doc, _ = self.upload("size.txt", b"old")
        with patch.object(documents, "MAX_FILE_SIZE", 4):
            with self.assertRaises(HTTPException) as error:
                self.upload("size.txt", b"oversize", replace_existing=True)
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(Path(doc.file_path).read_bytes(), b"old")

    def test_replacement_copy_failure_keeps_all_old_copies(self):
        doc, _ = self.upload("atomic.txt", b"old")
        other = models.Bot(bot_id="bot_atomic", name="Other", owner_id=self.user.id, status=models.BotStatus.active)
        self.db.add(other)
        copies = []
        for bot in (self.bot, other):
            bot.documents.append(doc)
            folder = Path("data") / bot.bot_id
            folder.mkdir(parents=True)
            target = folder / doc.filename
            target.write_bytes(b"old")
            copies.append(target)
        self.db.commit()
        real_copy = documents.shutil.copy2
        calls = 0
        def fail_second_copy(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("simulated disk failure")
            return real_copy(*args, **kwargs)
        with patch.object(documents.shutil, "copy2", side_effect=fail_second_copy):
            with self.assertRaises((OSError, HTTPException)):
                self.upload("atomic.txt", b"new", replace_existing=True)
        self.assertEqual([p.read_bytes() for p in copies], [b"old", b"old"])
        self.assertEqual(Path(doc.file_path).read_bytes(), b"old")

    def test_bot_human_bot_transcript_is_chronological(self):
        with patch.object(chat, "ask_rag", return_value=("Bot first", [])):
            self.send("First question")
        self.send("ติดต่อเจ้าหน้าที่")
        session = self.db.query(models.LiveSession).one()
        live_chat.staff_reply(session.id, schemas.StaffReply(message="Staff answer"), self.db, self.user)
        live_chat.end_session(session.id, self.db, self.user)
        with patch.object(chat, "ask_rag", return_value=("Bot last", [])):
            self.send("Last question")
        self.assertEqual([m["text"] for m in self.history()[0]["timeline"]],
                         ["First question", "Bot first", "ติดต่อเจ้าหน้าที่", "Staff answer", "Last question", "Bot last"])

    def test_line_model_failure_sends_error_and_does_not_count_success(self):
        from api.routers import line_webhook
        self.bot.is_line_connected = True
        self.bot.line_channel_token = "test-token"
        self.bot.line_channel_secret = "test-secret"
        self.db.commit()
        app = FastAPI()
        app.include_router(line_webhook.router)
        sent = []
        sdk = MagicMock()
        def capture(_api, _reply, _user, messages):
            sent.extend(messages)
        with patch.object(line_webhook, "SessionLocal", return_value=self.db), \
             patch.object(line_webhook, "_verify_signature", return_value=True), \
             patch.object(line_webhook, "_get_display_name", return_value="Customer"), \
             patch.object(line_webhook, "_show_line_loading"), \
             patch.object(line_webhook, "ApiClient", return_value=sdk), \
             patch.object(line_webhook, "MessagingApi"), \
             patch.object(line_webhook, "_line_reply_or_push", side_effect=capture), \
             patch.object(line_webhook, "ask_rag", side_effect=rag_pipeline.RagUnavailableError("offline")):
            with TestClient(app) as client:
                result = client.post(f"/api/line/webhook/{self.bot.bot_id}", json={"events": [{"type": "message", "replyToken": "reply", "message": {"type": "text", "text": "Policy question"}, "source": {"userId": "Utest"}}]})
        self.assertEqual(result.status_code, 200)
        row = self.db.query(models.Conversation).one()
        self.assertFalse(row.is_answered_by_bot)
        self.assertFalse(row.is_resolved)
        self.assertEqual([m.text for m in sent], [rag_pipeline.RAG_ERROR_MESSAGE])

    def test_line_grounding_rejection_sends_contact_flex(self):
        from api.routers import line_webhook
        from linebot.v3.messaging import FlexMessage

        self.bot.is_line_connected = True
        self.bot.line_channel_token = "test-token"
        self.bot.line_channel_secret = "test-secret"
        self.db.commit()
        app = FastAPI()
        app.include_router(line_webhook.router)
        sent = []
        sdk = MagicMock()

        def capture(_api, _reply, _user, messages):
            sent.extend(messages)

        with patch.object(line_webhook, "SessionLocal", return_value=self.db), \
             patch.object(line_webhook, "_verify_signature", return_value=True), \
             patch.object(line_webhook, "_get_display_name", return_value="Customer"), \
             patch.object(line_webhook, "_show_line_loading"), \
             patch.object(line_webhook, "ApiClient", return_value=sdk), \
             patch.object(line_webhook, "MessagingApi"), \
             patch.object(line_webhook, "_line_reply_or_push", side_effect=capture), \
             patch.object(line_webhook, "ask_rag", return_value=("REQUIRE_HUMAN_HANDOFF", [])):
            with TestClient(app) as client:
                result = client.post(
                    f"/api/line/webhook/{self.bot.bot_id}",
                    json={"events": [{
                        "type": "message",
                        "replyToken": "reply",
                        "message": {"type": "text", "text": "Unknown policy question"},
                        "source": {"userId": "Utest"},
                    }]},
                )

        self.assertEqual(result.status_code, 200)
        row = self.db.query(models.Conversation).one()
        self.assertFalse(row.is_answered_by_bot)
        self.assertFalse(row.is_resolved)
        self.assertEqual(len(sent), 1)
        self.assertIsInstance(sent[0], FlexMessage)


if __name__ == "__main__":
    unittest.main()
