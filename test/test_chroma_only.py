"""Chroma-only API, legacy-index safety and non-destructive upgrade."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
from pydantic import ValidationError
from api import schemas

ROOT = Path(__file__).resolve().parents[1]


class ChromaOnlyTests(unittest.TestCase):
    def test_create_and_update_reject_qdrant(self):
        for schema, args in [(schemas.BotCreate, {'name': 'Test'}), (schemas.BotUpdate, {})]:
            with self.subTest(schema=schema.__name__), self.assertRaises(ValidationError):
                schema(**args, vector_backend='qdrant')

    def test_legacy_index_is_not_opened_or_modified_as_chroma(self):
        from rag.retriever import get_vector_db
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp') as folder:
            path = Path(folder)
            marker = path / 'qdrant.json'
            marker.write_text('{}')
            with patch('rag.retriever.get_embedding_model', side_effect=AssertionError('must not load models')):
                self.assertIsNone(get_vector_db('legacy', path))
            self.assertEqual(marker.read_text(), '{}')
            self.assertFalse((path / 'chroma.sqlite3').exists())

    def test_upgrade_preserves_chroma_and_blocks_old_qdrant_until_rebuilt(self):
        from sqlalchemy import create_engine, text
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        spec = importlib.util.spec_from_file_location('chroma_migration', ROOT / 'migrations/versions/006_chroma_only.py')
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        engine = create_engine('sqlite://')
        with engine.begin() as conn:
            conn.execute(text('''CREATE TABLE bots (
                id INTEGER PRIMARY KEY, vector_backend VARCHAR(20) NOT NULL,
                status VARCHAR(20), active_index_path TEXT, knowledge_revision INTEGER NOT NULL,
                indexed_revision INTEGER NOT NULL, knowledge_blocked BOOLEAN NOT NULL,
                knowledge_update_status VARCHAR(20) NOT NULL, knowledge_update_error TEXT,
                knowledge_update_started_at DATETIME)'''))
            conn.execute(text("INSERT INTO bots VALUES (1,'chroma','active','keep-index',3,3,0,'ready',NULL,NULL), (2,'qdrant','active','legacy-index',4,4,0,'ready',NULL,NULL)"))
            before = dict(conn.execute(text('SELECT * FROM bots WHERE id=1')).mappings().one())
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            self.assertEqual(dict(conn.execute(text('SELECT * FROM bots WHERE id=1')).mappings().one()), before)
            legacy = conn.execute(text('SELECT * FROM bots WHERE id=2')).mappings().one()
            self.assertEqual(legacy['vector_backend'], 'chroma')
            self.assertEqual(legacy['status'], 'inactive')
            self.assertTrue(legacy['knowledge_blocked'])
            self.assertIsNone(legacy['active_index_path'])
            self.assertGreater(legacy['knowledge_revision'], legacy['indexed_revision'])
            self.assertEqual(legacy['knowledge_update_status'], 'error')
            self.assertIn('ChromaDB', legacy['knowledge_update_error'])
            from sqlalchemy.exc import IntegrityError
            with self.assertRaises(IntegrityError):
                conn.execute(text("UPDATE bots SET vector_backend='qdrant' WHERE id=1"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            self.assertEqual(conn.execute(text('SELECT vector_backend FROM bots WHERE id=2')).scalar(), 'chroma')
        engine.dispose()
