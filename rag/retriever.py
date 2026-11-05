import os
from functools import lru_cache
from config import EMBEDDING_MODEL, TOP_K, DEBUG
from langchain_core.embeddings import Embeddings


class _LazyEmbeddings(Embeddings):
    """Metadata-only category reads do not need to load an embedding model."""
    def embed_documents(self, texts):
        return get_embedding_model().embed_documents(texts)

    def embed_query(self, text):
        return get_embedding_model().embed_query(text)


def _exact_category_documents(db, question):
    from rag.evidence import category_request_matches
    from langchain_core.documents import Document
    stored = db.get(where={'category_overview': True}, limit=81)
    texts, metadata = stored.get('documents') or [], stored.get('metadatas') or []
    if len(texts) > 80:
        return []  # Do not pick from a possibly incomplete/ambiguous catalog.
    matches = [Document(page_content=text, metadata={
        k: v for k, v in meta.items() if not k.startswith('semantic_') and k != 'resolved_question'
    }) for text, meta in zip(texts, metadata)
        if meta and category_request_matches(question, meta.get('section', ''))]
    if len(matches) != 1:
        return []
    return matches


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
    # Opening Chroma on another engine's directory would create an empty index.
    if not (Path(path) / "chroma.sqlite3").is_file():
        return None
    from langchain_chroma import Chroma
    return Chroma(
        persist_directory=str(path),
        embedding_function=_LazyEmbeddings()
    )


def retrieve_docs(query, bot_id, score_threshold=1.05, *, history=None, semantic=None, original_question=None):
    """Multi-query candidate search, then joint query/passage semantic ranking."""
    from config import SEMANTIC_SEARCH_ENABLED
    from api.knowledge import resolve_index_path
    from rag.semantic import prepare_query, rank_candidates, QueryPlan
    from rag.evidence import section_matches
    from langchain_core.documents import Document
    import logging
    enabled = SEMANTIC_SEARCH_ENABLED if semantic is None else semantic
    persist_dir = resolve_index_path(bot_id)
    if persist_dir is None or not os.path.isfile(os.path.join(persist_dir, "chroma.sqlite3")):
        return []
    db = get_vector_db(bot_id, persist_dir)
    if db is None:
        return []
    current_question = original_question or query
    exact = _exact_category_documents(db, current_question)
    if exact:
        return exact
    plan = prepare_query(current_question, history) if enabled else QueryPlan(query, (query,))
    candidates, distances, seen = [], [], {}
    for search in plan.queries:
        for doc, distance in db.similarity_search_with_score(search, k=max(TOP_K, 20 if enabled else 8)):
            key = (doc.metadata.get("source"), doc.metadata.get("page"), doc.page_content)
            if key not in seen:
                # Stored metadata must never impersonate runtime semantic approval.
                metadata = {k:v for k,v in doc.metadata.items() if not k.startswith('semantic_') and k != 'resolved_question'}
                candidates.append(Document(page_content=doc.page_content,metadata=metadata))
                distances.append(distance)
                seen[key] = len(candidates) - 1
            else:
                position = seen[key]
                distances[position] = min(distances[position], distance)
    ranked = None
    if enabled:
        try:
            ranked = rank_candidates(plan.question, candidates[:60])[:12]
        except Exception:
            logging.getLogger(__name__).exception('Semantic reranking unavailable; using lexical evidence safeguards')
    if ranked is None:
        ranked = [doc for doc, distance in zip(candidates, distances) if distance <= score_threshold]
    sections = {}
    for doc in ranked:
        if section_matches(plan.question, doc.metadata.get('section','')):
            sections[(doc.metadata.get('source'),doc.metadata['section'])] = doc
    overview = any(word in current_question for word in ('อะไรบ้าง','ต้องทำ','ขั้นตอน','ระเบียบ','กฎ','วิธี','อย่างไร'))
    if enabled and ranked and overview and ranked[0].metadata.get('semantic_relevance',0) >= 0.5:
        anchor = ranked[0]
        if anchor.metadata.get('section'):
            key = (anchor.metadata.get('source'),anchor.metadata['section'])
            sections.setdefault(key,anchor)
            anchor.metadata['semantic_section_match'] = True
    output = list(ranked)
    for (source, section), anchor in sections.items():
        if hasattr(db,'get_section_documents'):
            expanded = db.get_section_documents(source,section)
        else:
            stored=db.get(where={"$and":[{"source":source},{"section":section}]},limit=81)
            expanded=[Document(page_content=t,metadata=m) for t,m in zip(stored['documents'],stored['metadatas'])]
        if len(expanded)>80:
            for doc in output:
                if (doc.metadata.get('source'),doc.metadata.get('section'))==(source,section):
                    doc.metadata['section_incomplete']=True
            continue
        for doc in expanded:
            metadata={k:v for k,v in doc.metadata.items() if not k.startswith('semantic_') and k!='resolved_question'}
            for key in ('semantic_relevance','resolved_question','semantic_section_match'):
                if key in anchor.metadata: metadata[key]=anchor.metadata[key]
            output.append(Document(page_content=doc.page_content,metadata=metadata))
    unique={}
    for doc in output:
        key=(doc.metadata.get('source'),doc.metadata.get('page'),doc.page_content)
        # Expanded section copies carry complete runtime metadata.
        unique[key]=doc
    return list(unique.values())
