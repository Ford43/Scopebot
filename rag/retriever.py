import os
from functools import lru_cache
from config import EMBEDDING_MODEL, TOP_K, DEBUG


@lru_cache(maxsize=1)
def get_embedding_model():
    from langchain_huggingface import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def get_vector_db(bot_id, persist_directory=None):
    from api.knowledge import resolve_index_path
    path = persist_directory or resolve_index_path(bot_id)
    if path is None:
        return None
    from pathlib import Path
    if (Path(path) / "qdrant.json").is_file():
        from rag.qdrant_store import QdrantIndex
        return QdrantIndex(path, get_embedding_model())
    from langchain_chroma import Chroma
    return Chroma(
        persist_directory=str(path),
        embedding_function=get_embedding_model()
    )


def retrieve_docs(query, bot_id, score_threshold=1.05):
    """Return docs whose distance score is at or below threshold (lower = closer)."""
    from api.knowledge import resolve_index_path
    persist_dir = resolve_index_path(bot_id)
    if persist_dir is None or not any(os.path.isfile(os.path.join(persist_dir, name)) for name in ("chroma.sqlite3", "qdrant.json")):
        return []

    db = get_vector_db(bot_id, persist_dir)

    # ดึงมากกว่า TOP_K เล็กน้อย กันหัวข้อยาวถูกตัดคนละ chunk
    fetch_k = max(TOP_K, 8)
    results = db.similarity_search_with_score(query, k=fetch_k)

    results = sorted(results, key=lambda x: x[1])

    filtered_docs = []

    for doc, score in results:
        if DEBUG:
            print(f"[DEBUG] retrieve score={score:.4f} source={doc.metadata.get('source')}")
        if score <= score_threshold:
            filtered_docs.append(doc)

    return filtered_docs
