# RAG correctness changes (2026-10-29)

- Grounding now requires literal support as well as factual-token checks. It
  rejects unsupported assertions, cropped restrictions and reassigned numeric
  values. Quotes are checked against their full source units. Deterministic
  shift formatting remains supported. The model is instructed to preserve
  original wording and conditions; unsupported paraphrases can be declined.
- DOCX ingestion reads paragraphs and tables in document order, including nested
  tables. The first row is retained; textual column labels (or a declared header)
  are repeated on later rows. Numeric first records are retained as data.
- Unnumbered headings now carry section metadata, enabling complete-section
  retrieval. A selection exceeding 80 evidence units is explicitly incomplete
  and cannot be presented as a complete answer.
- Short followups retain a bounded chain of preceding questions through search
  and reranking, even when query rewriting fails. Previous answers are not facts.

## Applying to existing knowledge

Restart the backend to load the new code. Rebuild each affected bot through the
existing knowledge publication flow (`python -m rag.ingest BOT_ID`) so stored
chunks contain tables and section metadata. Rebuilding uses immutable index
generations; do not delete the active index manually. No database migration or
new dependency is required. This change does not rebuild production indexes.

## Verification

Regression coverage is in `test/test_rag_correctness.py`. It includes reversed
negation, repeated negation, conditions across lines, cropped quotes, swapped
prices, DOCX table rows, full section expansion and consecutive followups.
External model responses are mocked for reproducible regression tests; these
tests do not measure answer quality of a live model on production documents.

Verified: 66 focused tests and 139 full backend tests passed. The full suite
includes real Chroma/Qdrant index tests with deterministic local embeddings.

## Multi-file ingestion and identifier answers

`INGEST_TIMEOUT_SEC` defaults to 900 seconds and is configurable. Failed updates
keep the previous published generation; an active bot may still have an update
error, so check the knowledge update status when adding files.

Explicit identifier questions (for example INV-015) exclude other identifiers.
For bounded evidence from one source containing all requested identifiers, the
bot can return original text with labels and restrictions, avoiding rejection
of valid CSV records solely because a model paraphrased them. Regression tests
are in `test/test_code_answers.py`.
