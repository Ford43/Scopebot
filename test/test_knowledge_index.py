"""Real Chroma, isolated child processes and deterministic local embeddings."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class KnowledgeIndexTests(unittest.TestCase):
    def test_real_chroma_rebuild_keeps_open_old_index_and_reads_both_files(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tmp") as temp:
            script = r'''
import sys
from pathlib import Path
from langchain_core.embeddings import Embeddings
from langchain_chroma import Chroma
from rag.ingest import build_index
class LocalEmbedding(Embeddings):
    def embed_documents(self, texts):
        return [self.embed_query(text) for text in texts]
    def embed_query(self, text):
        return [float(text.lower().count(word)) for word in ("alpha", "beta", "service")]
root = Path(sys.argv[1])
docs = root / "documents"
docs.mkdir()
(docs / "a.TXT").write_text("Alpha service: 100 baht", encoding="utf-8")
embedding = LocalEmbedding()
build_index(docs, root / "old", embedding=embedding)
old = Chroma(persist_directory=str(root / "old"), embedding_function=embedding)
assert len(old.get()["ids"]) == 1
(docs / "b.txt").write_text("Beta service: 200 baht", encoding="utf-8")
build_index(docs, root / "new", embedding=embedding)
new = Chroma(persist_directory=str(root / "new"), embedding_function=embedding)
assert len(new.get()["ids"]) == 2
assert "Alpha" in old.similarity_search("Alpha service", k=1)[0].page_content
assert "Beta" in new.similarity_search("Beta service", k=1)[0].page_content
assert {item["source"] for item in new.get()["metadatas"]} == {"a.TXT", "b.txt"}
# An empty/unreadable addition must fail and leave both existing indexes intact.
(docs / "empty.txt").write_text("")
try:
    build_index(docs, root / "bad", embedding=embedding)
except ValueError:
    pass
else:
    raise AssertionError("Empty file must not publish partial knowledge")
assert len(old.get()["ids"]) == 1
assert len(new.get()["ids"]) == 2
'''
            result = subprocess.run([sys.executable, "-c", script, temp], cwd=ROOT,
                                    capture_output=True, timeout=90,
                                    env={**os.environ, "PYTHONIOENCODING": "utf-8", "ANONYMIZED_TELEMETRY": "False"})
            self.assertEqual(result.returncode, 0, result.stdout.decode(errors="replace") + result.stderr.decode(errors="replace"))

    def test_migration_preserves_existing_bot_and_legacy_defaults(self):
        from sqlalchemy import create_engine, text, inspect
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        spec = importlib.util.spec_from_file_location("knowledge_migration", ROOT / "migrations/versions/004_knowledge_generations.py")
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        engine = create_engine("sqlite://")
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE bots (id INTEGER PRIMARY KEY, status TEXT)"))
            conn.execute(text("INSERT INTO bots VALUES (1, 'active')"))
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
            row = conn.execute(text("SELECT * FROM bots")).mappings().one()
            self.assertEqual(row["status"], "active")
            self.assertIsNone(row["active_index_path"])
            self.assertEqual(row["knowledge_revision"], 0)
            self.assertFalse(row["knowledge_blocked"])
            self.assertEqual(row["knowledge_update_status"], "idle")
            with Operations.context(MigrationContext.configure(conn)):
                migration.downgrade()
            self.assertEqual({c["name"] for c in inspect(conn).get_columns("bots")}, {"id", "status"})
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
