"""Build isolated indexes; only api.knowledge publishes them."""
import argparse
import sys
from pathlib import Path


def build_index(snapshot, output, *, embedding=None, backend="chroma"):
    from rag.document_loader import load_documents
    from rag.chunker import split_documents

    output = Path(output)
    if output.exists():
        raise ValueError("A generation must use a new index directory")
    if backend not in {"chroma", "qdrant"}:
        raise ValueError("Unknown vector backend")
    docs = load_documents(data_path=str(snapshot), strict=True)
    if not docs:
        raise ValueError("No readable documents")
    chunks = split_documents(docs)
    if not chunks:
        raise ValueError("No readable chunks")
    if embedding is None:
        from langchain_huggingface import HuggingFaceEmbeddings
        from config import EMBEDDING_MODEL
        embedding = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    if backend == "qdrant":
        from rag.qdrant_store import build_qdrant
        build_qdrant(chunks, output, embedding)
        return True
    from langchain_chroma import Chroma
    db = Chroma.from_documents(documents=chunks, embedding=embedding, persist_directory=str(output))
    saved = db.get(limit=1, include=["documents"])
    if db._collection.count() != len(chunks) or not saved["documents"] or not saved["documents"][0]:
        raise RuntimeError("Index verification failed")
    return True


def ingest(bot_id):
    """Keep manual reindexing on the safe publication path."""
    from api.database import SessionLocal
    from api import models
    from api.knowledge import state_lock, request_update, run_update
    with state_lock(), SessionLocal() as db:
        bot = db.query(models.Bot).filter_by(bot_id=bot_id).one()
        request_update(bot)
        db.commit()
        db_id, owner = bot.id, bot.owner_id
    run_update(bot_id, db_id, "documents", owner)


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("bot_id", nargs="?")
    parser.add_argument("--snapshot")
    parser.add_argument("--output")
    parser.add_argument("--backend", choices=["chroma", "qdrant"], default="chroma")
    args = parser.parse_args()
    if args.snapshot and args.output:
        build_index(args.snapshot, args.output, backend=args.backend)
    elif args.bot_id:
        ingest(args.bot_id)
    else:
        parser.error("Provide a bot ID, or --snapshot and --output")
