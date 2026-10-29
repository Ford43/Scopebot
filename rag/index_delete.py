"""Remove one source without loading embedding models or rebuilding survivors."""
from pathlib import Path


def delete_source(path, source):
    path = Path(path)
    if (path / 'qdrant.json').is_file():
        from rag.qdrant_store import QdrantIndex
        from qdrant_client import models
        store = QdrantIndex(path, embedding=None)
        with store._connection() as client:
            condition = models.Filter(must=[models.FieldCondition(
                key='metadata.source', match=models.MatchValue(value=source))])
            client.delete(collection_name=store.manifest['collection'],
                          points_selector=models.FilterSelector(filter=condition), wait=True)
            if client.count(collection_name=store.manifest['collection'],
                            count_filter=condition, exact=True).count:
                raise RuntimeError('Source deletion verification failed')
        return
    if not (path / 'chroma.sqlite3').is_file():
        raise RuntimeError('Index unavailable for incremental deletion')
    import chromadb
    client = chromadb.PersistentClient(path=str(path))
    collection = client.get_collection('langchain')
    collection.delete(where={'source': source})
    if collection.get(where={'source': source}, limit=1)['ids']:
        raise RuntimeError('Source deletion verification failed')
