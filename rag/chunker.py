from langchain_core.documents import Document

from rag.evidence import (
    EVIDENCE_OVERLAP,
    MAX_EVIDENCE_CHARS,
    split_evidence_units,
)


def split_documents(documents):
    units = split_evidence_units(
        documents,
        max_chars=MAX_EVIDENCE_CHARS,
        overlap=EVIDENCE_OVERLAP,
    )
    chunks = [
        Document(page_content=unit.text, metadata=unit.metadata)
        for unit in units
    ]
    print(f"✂️ Total chunks: {len(chunks)}")
    return chunks
