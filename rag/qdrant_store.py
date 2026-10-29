"""Qdrant adapter with Chroma-compatible squared-Euclidean distances.

Each generation owns its collection. Only the app's revision-checked database
pointer publishes it. Local mode is for a single API process; server mode uses
the same interface without opening Qdrant storage files in the API.
"""
from contextlib import contextmanager
import json
from pathlib import Path
import uuid

from filelock import FileLock
from langchain_core.documents import Document

MANIFEST = "qdrant.json"


def _client(output: Path, mode: str):
    from qdrant_client import QdrantClient
    from config import QDRANT_URL, QDRANT_API_KEY
    if mode == "server":
        if not QDRANT_URL:
            raise RuntimeError("ต้องตั้ง QDRANT_URL เพื่อใช้ฐาน Qdrant Server ชุดนี้")
        return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=30)
    if mode != "local":
        raise ValueError("Invalid Qdrant storage mode")
    return QdrantClient(path=str(output / "storage"))


def build_qdrant(chunks, output: Path, embedding):
    from qdrant_client import models
    from config import QDRANT_URL
    output.mkdir(parents=True, exist_ok=False)
    mode = "server" if QDRANT_URL else "local"
    collection = "scopebot_" + uuid.uuid4().hex
    client = _client(output, mode)
    try:
        for start in range(0, len(chunks), 64):
            batch = chunks[start:start + 64]
            vectors = embedding.embed_documents([doc.page_content for doc in batch])
            if len(vectors) != len(batch) or not vectors:
                raise RuntimeError("Embedding count mismatch")
            if start == 0:
                client.create_collection(collection_name=collection, vectors_config=models.VectorParams(
                    size=len(vectors[0]), distance=models.Distance.EUCLID))
            client.upsert(collection_name=collection, wait=True, points=[
                models.PointStruct(id=start + i, vector=vector, payload={
                    "page_content": doc.page_content, "metadata": doc.metadata,
                }) for i, (doc, vector) in enumerate(zip(batch, vectors))
            ])
        saved, _ = client.scroll(collection_name=collection, limit=1, with_payload=True, with_vectors=False)
        if client.count(collection_name=collection, exact=True).count != len(chunks) or not saved or not saved[0].payload.get("page_content"):
            raise RuntimeError("Qdrant index verification failed")
        (output / MANIFEST).write_text(json.dumps({"mode": mode, "collection": collection}), encoding="utf-8")
    finally:
        client.close()


class QdrantIndex:
    def __init__(self, output, embedding):
        self.output = Path(output)
        self.embedding = embedding
        self.manifest = json.loads((self.output / MANIFEST).read_text(encoding="utf-8"))

    @contextmanager
    def _connection(self):
        # Open and close local storage in the calling thread. Concurrent local
        # requests serialize; each generation has its own lock and directory.
        lock = FileLock(str(self.output / ".query.lock")) if self.manifest["mode"] == "local" else None
        if lock is not None:
            lock.acquire()
        try:
            client = _client(self.output, self.manifest["mode"])
            try:
                yield client
            finally:
                client.close()
        finally:
            if lock is not None:
                lock.release()

    def similarity_search_with_score(self, query, k):
        vector = self.embedding.embed_query(query)
        with self._connection() as client:
            result = client.query_points(collection_name=self.manifest["collection"], query=vector,
                                         limit=k, with_payload=True, with_vectors=False)
        # Qdrant EUCLID returns a distance; Chroma's default L2 returns its
        # square. Normalize here so the existing 1.05 threshold means the same.
        return [(Document(page_content=point.payload["page_content"], metadata=point.payload.get("metadata") or {}),
                 float(point.score) ** 2) for point in result.points]

    def close(self):
        """Connections are scoped to each query; kept for explicit client usage."""

    def get_section_documents(self, source, section):
        from qdrant_client import models
        with self._connection() as client:
            points, _ = client.scroll(collection_name=self.manifest["collection"],
                scroll_filter=models.Filter(must=[
                    models.FieldCondition(key="metadata.source", match=models.MatchValue(value=source)),
                    models.FieldCondition(key="metadata.section", match=models.MatchValue(value=section))]),
                limit=81, with_payload=True, with_vectors=False)
        return [Document(page_content=p.payload["page_content"], metadata=p.payload.get("metadata") or {}) for p in points]
