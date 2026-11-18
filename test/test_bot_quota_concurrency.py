"""Bot quota checks must share a transaction with creation, across sessions."""
import os
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Query, sessionmaker
from api import models, schemas
from api.database import Base
from api.routers import bots


class BotQuotaConcurrencyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.engine = create_engine('sqlite:///' + str(Path(self.tmp.name) / 'quota.db'),
                                    connect_args={'check_same_thread': False, 'timeout': 10})
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        with self.Session() as db:
            owner = models.User(email='owner@example.test', username='owner',
                                hashed_password='unused', max_bots=1)
            db.add(owner)
            db.commit()
            self.owner_id = owner.id
        self.storage = Path(self.tmp.name) / 'data'
        setting = patch.object(bots, 'UPLOAD_BASE', str(self.storage))
        setting.start()
        self.addCleanup(setting.stop)

    def create(self, name, cached_quota=1):
        with self.Session() as db:
            try:
                result = bots.create_bot(schemas.BotCreate(name=name), db,
                                         SimpleNamespace(id=self.owner_id, max_bots=cached_quota))
                return result.bot_id
            except HTTPException as exc:
                return exc.status_code

    def test_two_simultaneous_requests_cannot_use_the_same_quota_slot(self):
        barrier = threading.Barrier(2)
        original_count = Query.count

        def simultaneous_count(query):
            count = original_count(query)
            if query.column_descriptions[0].get('entity') is models.Bot:
                # Before the fix both readers see zero. With DB serialization,
                # the second reader cannot arrive until the first commits.
                try:
                    barrier.wait(timeout=1)
                except threading.BrokenBarrierError:
                    pass
            return count

        with patch.object(Query, 'count', simultaneous_count), ThreadPoolExecutor(2) as pool:
            results = list(pool.map(self.create, ['First', 'Second']))
        self.assertEqual(results.count(400), 1, results)
        with self.Session() as db:
            self.assertEqual(db.query(models.Bot).count(), 1)
        self.assertEqual(len(list(self.storage.iterdir())), 1)

    def test_quota_is_read_from_database_not_stale_authenticated_user(self):
        with self.Session() as db:
            db.query(models.User).filter_by(id=self.owner_id).update({'max_bots': 0})
            db.commit()
        self.assertEqual(self.create('Stale quota', cached_quota=10), 400)
        with self.Session() as db:
            self.assertEqual(db.query(models.Bot).count(), 0)
        self.assertFalse(self.storage.exists())

    def test_allowed_creation_keeps_owner_and_normal_response(self):
        result = self.create('Allowed')
        self.assertTrue(result.startswith('bot_'))
        with self.Session() as db:
            row = db.query(models.Bot).one()
            self.assertEqual((row.name, row.owner_id), ('Allowed', self.owner_id))
        self.assertTrue((self.storage / result).is_dir())
