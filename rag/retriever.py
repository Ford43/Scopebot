import os
import re
from functools import lru_cache
from config import EMBEDDING_MODEL, TOP_K, DEBUG
from langchain_core.embeddings import Embeddings
from rag.identifiers import extract_identifiers


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


def _exact_evidence_documents(db, question):
    """Bounded metadata read; only unique explicit facts or whole section titles."""
    from rag.evidence import direct_fact_matches, _compact
    from langchain_core.documents import Document
    stored = db.get(limit=401)
    if len(stored.get('documents') or []) > 400:
        return []
    docs = [Document(page_content=t, metadata={k: v for k, v in (m or {}).items()
            if not k.startswith('semantic_') and k != 'resolved_question'})
            for t, m in zip(stored.get('documents') or [], stored.get('metadatas') or [])]
    query = re.sub(r'^(?:ขอ|ช่วย)?(?:ขั้นตอน|วิธี|ระเบียบ)', '', question.strip())
    query = re.sub(r'(?:ครับ|ค่ะ|หน่อย)+$', '', query).strip()
    query = re.sub(r'(?:ต้องทำอะไรบ้าง|มีอะไรบ้าง|ทำอย่างไร)$', '', query).strip()
    if query != question.strip():
        matched = [d for d in docs if d.metadata.get('section') and
                   _compact(re.sub(r'^\d+[.)]\s*', '', d.metadata['section']).replace('(', '').replace(')', '')) == _compact(query)]
        if matched and len(matched) <= 80 and len({(d.metadata.get('source'), d.metadata['section']) for d in matched}) == 1:
            return matched
    matched = [d for d in docs if direct_fact_matches(question, d.page_content)]
    unique = {(d.metadata.get('source'), d.metadata.get('page'), d.page_content): d for d in matched}
    return list(unique.values()) if len(unique) == 1 else []


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
    from rag.evidence import section_matches, build_retrieval_query
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
    contextual_question = build_retrieval_query(current_question, history)
    codes = extract_identifiers(contextual_question)
    if codes:
        records = db.get(where_document={'$or': [{'$contains': code} for code in codes]} if len(codes) > 1 else {'$contains': codes[0]}, limit=81)
        matches = []
        for text, metadata in zip(records.get('documents') or [], records.get('metadatas') or []):
            present = set(extract_identifiers(text))
            if metadata.get('source', '').lower().endswith('.csv') and present.intersection(codes):
                matches.append(Document(page_content=text, metadata={k: v for k, v in metadata.items() if not k.startswith('semantic_') and k != 'resolved_question'}))
        found = {code for doc in matches for code in extract_identifiers(doc.page_content) if code in codes}
        if len(records.get('documents') or []) <= 80 and len(matches) == len(codes) and found == set(codes) and len({d.metadata.get('source') for d in matches}) == 1:
            return matches
    exact = _exact_category_documents(db, current_question)
    if exact:
        return exact
    exact = _exact_evidence_documents(db, current_question)
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
