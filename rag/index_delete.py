"""Remove one source without loading embedding models or rebuilding survivors."""
from pathlib import Path


def delete_source(path, source):
    path = Path(path)
    if not (path / 'chroma.sqlite3').is_file():
        raise RuntimeError('Index unavailable for incremental deletion')
    import chromadb
    client = chromadb.PersistentClient(path=str(path))
    collection = client.get_collection('langchain')
    collection.delete(where={'source': source})
    if collection.get(where={'source': source}, limit=1)['ids']:
        raise RuntimeError('Source deletion verification failed')
