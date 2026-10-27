"""Both engines must expose the same squared-Euclidean retrieval contract."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
from api import schemas

ROOT = Path(__file__).resolve().parents[1]


class BackendSchemaTests(unittest.TestCase):
    def test_existing_clients_default_to_chroma(self):
        self.assertEqual(schemas.BotCreate(name="Old client").vector_backend, "chroma")

    def test_can_choose_qdrant(self):
        self.assertEqual(schemas.BotCreate(name="Trial", vector_backend="qdrant").vector_backend, "qdrant")

    def test_unknown_backend_is_rejected(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            schemas.BotCreate(name="Invalid", vector_backend="unknown")

    def test_backend_migration_defaults_existing_bots_to_chroma(self):
        import importlib.util
        from sqlalchemy import create_engine, text
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        spec = importlib.util.spec_from_file_location("backend_migration", ROOT / "migrations/versions/005_vector_backend.py")
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
            self.assertEqual(row["vector_backend"], "chroma")
        engine.dispose()

    def test_server_connection_uses_configured_endpoint_and_credentials(self):
        from rag.qdrant_store import _client
        with patch("config.QDRANT_URL", "http://qdrant.test:6333"), \
             patch("config.QDRANT_API_KEY", "test-key"), \
             patch("qdrant_client.QdrantClient") as client:
            _client(Path("unused"), "server")
        client.assert_called_once_with(url="http://qdrant.test:6333", api_key="test-key", timeout=30)

    def test_server_generation_never_silently_falls_back_to_local(self):
        from rag.qdrant_store import _client
        with patch("config.QDRANT_URL", ""):
            with self.assertRaises(RuntimeError):
                _client(Path("unused"), "server")


class QdrantIntegrationTests(unittest.TestCase):
    def test_real_qdrant_build_reopen_search_and_bot_isolation(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tmp") as temp:
            script = r'''
import sys
from pathlib import Path
from langchain_core.embeddings import Embeddings
from rag.ingest import build_index
from rag.qdrant_store import QdrantIndex
from unittest.mock import patch
class LocalEmbedding(Embeddings):
    def embed_documents(self, texts):
        return [self.embed_query(text) for text in texts]
    def embed_query(self, text):
        return [float(text.lower().count(word)) for word in ("alpha", "beta", "service")]
root = Path(sys.argv[1])
docs = root / "documents"
docs.mkdir()
(docs / "a.txt").write_text("Alpha service: 100 baht", encoding="utf-8")
embedding = LocalEmbedding()
build_index(docs, root / "first", embedding=embedding, backend="qdrant")
old = QdrantIndex(root / "first", embedding)
old_result = old.similarity_search_with_score("Alpha service", k=8)
assert len(old_result) == 1 and old_result[0][1] == 0
(docs / "b.txt").write_text("Beta service: 200 baht", encoding="utf-8")
build_index(docs, root / "second", embedding=embedding, backend="qdrant")
new = QdrantIndex(root / "second", embedding)
results = new.similarity_search_with_score("Beta service", k=8)
assert len(results) == 2 and "Beta" in results[0][0].page_content
assert abs(results[1][1] - 2.0) < 0.00001, results
assert {d.metadata["source"] for d, _ in results} == {"a.txt", "b.txt"}
assert len(old.similarity_search_with_score("Beta service", k=8)) == 1
old.close()
new.close()
# Persistence works when reopened, without re-embedding documents.
reopened = QdrantIndex(root / "second", embedding)
assert len(reopened.similarity_search_with_score("Alpha service", k=8)) == 2
reopened.close()
from rag.retriever import retrieve_docs
with patch("api.knowledge.resolve_index_path", return_value=root / "second"), patch("rag.retriever.get_embedding_model", return_value=embedding):
    selected = retrieve_docs("Beta service", "trial")
    assert len(selected) == 1 and "Beta" in selected[0].page_content
'''
            result = subprocess.run([sys.executable, "-c", script, temp], cwd=ROOT,
                                    capture_output=True, timeout=90,
                                    env={**os.environ, "QDRANT_URL": "", "PYTHONIOENCODING": "utf-8"})
            self.assertEqual(result.returncode, 0, result.stdout.decode(errors="replace") + result.stderr.decode(errors="replace"))


if __name__ == "__main__":
    unittest.main()
