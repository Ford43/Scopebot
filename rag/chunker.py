from langchain_core.documents import Document
import re

from rag.evidence import (
    EVIDENCE_OVERLAP,
    MAX_EVIDENCE_CHARS,
    split_evidence_units,
)


def split_documents(documents):
    prepared = []
    overviews = []
    for document in documents:
        parts = re.split(r'(?m)^(?=หมวดหมู่\s*[:：])', document.page_content)
        if len(parts) == 1:
            prepared.append(document)
            continue
        if parts[0].strip():
            prepared.append(Document(page_content=parts[0], metadata=dict(document.metadata)))
        for part in parts[1:]:
            heading, _, body = part.strip().partition('\n')
            if not body.strip():
                continue
            metadata = {**document.metadata, 'category': heading.strip()}
            prepared.append(Document(page_content=body, metadata=metadata))
            # Only whole, unpaged source sections can promise completeness.
            # Bound the extractive answer below LINE's text message limit.
            if not metadata.get('page') and len(part.strip()) <= 4000:
                overviews.append(Document(page_content=part.strip(), metadata={
                    **metadata, 'section': heading.strip(), 'category_overview': True,
                    'evidence_unit': 0, 'unit_order': 0,
                }))
    units = split_evidence_units(
        prepared,
        max_chars=MAX_EVIDENCE_CHARS,
        overlap=EVIDENCE_OVERLAP,
    )
    chunks = [
        Document(page_content=(unit.metadata['category'] + '\n' + unit.text
                               if unit.metadata.get('category') else unit.text), metadata=unit.metadata)
        for unit in units
    ]
    chunks.extend(overviews)
    print(f"✂️ Total chunks: {len(chunks)}")
    return chunks
