# Category retrieval implementation

Approved scope: preserve explicit category membership and answer complete category requests from source text before comparing larger models. Keep grounding and bot isolation. No global threshold reduction.

1. Add regression tests for category ingestion, exact category requests, unrelated categories, price constraints, oversized sections and source ambiguity. Demonstrate failure first.
2. Add category-aware chunks in rag/chunker.py: preserve item units with parent text, plus bounded complete category records for unpaged documents. Keep other document handling unchanged.
3. Retrieve exact category records from the selected bot index before model rewriting/reranking; delay embedding model loading until vector search. Return verbatim category evidence through existing validation and citation handling. Ambiguous, partial and oversized records must not claim completeness.
4. Run focused RAG and required backend regressions. Test the original menu in an isolated temporary Chroma index using deterministic embeddings, without changing published knowledge.
5. Document supported input format, remaining limits and requirement to rebuild the target bot through the normal publication flow. Do not rebuild production knowledge as part of code verification.
