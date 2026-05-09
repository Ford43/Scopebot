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


def retrieve_docs(query, bot_id, score_threshold=1.5):

    db = get_vector_db(bot_id)

<<<<<<< HEAD
    results = db.similarity_search_with_score(query, k=3)
=======
    results = db.similarity_search_with_score(query, k=TOP_K)
>>>>>>> master

    results = sorted(results, key=lambda x: x[1])

    filtered_docs = []

    for doc, score in results:
        if score <= score_threshold:
            filtered_docs.append(doc)

    return filtered_docs