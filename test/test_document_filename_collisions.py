"""Case aliases must never overwrite another document's bot copy."""
import asyncio
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import BackgroundTasks, HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from api import models
from api.database import Base
from api.routers import documents


class DocumentFilenameCollisionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.temp.name)
        self.lock_patch = patch('api.knowledge.vector_root', return_value=Path(self.temp.name) / 'vectors')
        self.lock_patch.start()
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = models.User(email='collision@example.test', username='collision', hashed_password='unused')
        self.db.add(self.user)
        self.db.flush()
        self.bot = models.Bot(bot_id='bot_case', name='Case', owner_id=self.user.id)
        self.db.add(self.bot)
        self.db.commit()
        self.first = self.upload('Policy.txt', b'first original')
        self.second = self.upload('policy.txt', b'second original')
        self.assign(self.first)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.lock_patch.stop()
        os.chdir(self.cwd)
        self.temp.cleanup()

    def upload(self, name, content, replace=False):
        return asyncio.run(documents.upload_document(
            BackgroundTasks(), UploadFile(filename=name, file=io.BytesIO(content)),
            'test', self.db, self.user, replace))

    def assign(self, doc):
        return documents.assign_to_bot(doc.id, self.bot.bot_id, BackgroundTasks(), self.db, self.user)

    def assert_conflict(self, action):
        with self.assertRaises(HTTPException) as caught:
            action()
        self.assertEqual(caught.exception.status_code, 409)

    def assert_originals(self):
        self.assertEqual(Path(self.first.file_path).read_bytes(), b'first original')
        self.assertEqual(Path(self.second.file_path).read_bytes(), b'second original')
        self.assertEqual(Path('data/bot_case/Policy.txt').read_bytes(), b'first original')

    def legacy_collision(self):
        self.bot.documents.append(self.second)
        self.db.commit()

    def test_assign_case_alias_rejects_without_overwriting_or_linking(self):
        self.assert_conflict(lambda: self.assign(self.second))
        self.assertEqual([doc.id for doc in self.bot.documents], [self.first.id])
        self.assert_originals()

    def test_assign_rejects_untracked_destination_file(self):
        other = self.upload('orphan.txt', b'new')
        Path('data/bot_case/ORPHAN.txt').write_bytes(b'old untracked')
        self.assert_conflict(lambda: self.assign(other))
        self.assertNotIn(other, self.bot.documents)
        self.assertEqual(Path('data/bot_case/ORPHAN.txt').read_bytes(), b'old untracked')

    def test_replace_legacy_collision_preserves_all_files(self):
        self.legacy_collision()
        before = set(Path('data/library').rglob('*'))
        self.assert_conflict(lambda: self.upload('Policy.txt', b'replacement', True))
        self.assert_originals()
        self.assertEqual(set(Path('data/library').rglob('*')), before)

    def test_unassign_legacy_collision_preserves_copy_and_relations(self):
        self.legacy_collision()
        self.assert_conflict(lambda: documents.unassign_from_bot(
            self.second.id, self.bot.bot_id, BackgroundTasks(), self.db, self.user))
        self.assertEqual(len(self.bot.documents), 2)
        self.assert_originals()

    def test_delete_legacy_collision_preserves_copy_and_relations(self):
        self.legacy_collision()
        self.assert_conflict(lambda: documents.delete_document(
            self.second.id, BackgroundTasks(), self.db, self.user))
        self.assertEqual(len(self.bot.documents), 2)
        self.assert_originals()

    def test_same_document_assignment_and_replacement_still_work(self):
        self.assign(self.first)
        self.assertEqual(len(self.bot.documents), 1)
        self.upload('Policy.txt', b'updated', True)
        self.assertEqual(Path('data/bot_case/Policy.txt').read_bytes(), b'updated')
        self.assertEqual(Path(self.second.file_path).read_bytes(), b'second original')
