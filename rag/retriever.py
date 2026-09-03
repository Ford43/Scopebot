import os
from config import EMBEDDING_MODEL, VECTOR_DB_PATH, TOP_K, DEBUG

try:
    from langchain_chroma import Chroma
except:
    from langchain_community.vectorstores import Chroma

from langchain_huggingface import HuggingFaceEmbeddings


embedding_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL
)


def get_vector_db(bot_id):
    return Chroma(
        persist_directory=f"vector_db/{bot_id}",
        embedding_function=embedding_model
    )


def retrieve_docs(query, bot_id, score_threshold=1.05):
    """Return docs whose distance score is at or below threshold (lower = closer)."""
    persist_dir = f"vector_db/{bot_id}"
    if not os.path.isdir(persist_dir) or not os.listdir(persist_dir):
        return []

    db = get_vector_db(bot_id)

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