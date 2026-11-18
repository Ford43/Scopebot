# RAG correctness changes (2026-10-29)

## Receipt condition validation (2026-11-13)

Grounding now preserves complete clauses beginning with `โดย` (including
`โดยแสดงใบเสร็จ` and `โดยมีใบเสร็จ`) and English `with` / `without`.
The same markers preserve separately listed requirements during chunking and
check retrieved sibling requirements. Cropped clauses are rejected; complete
answers retain their source citation. Regression coverage in
`test_condition_accuracy` exercises both rejection and successful publication.
This is deterministic validation, not a guarantee of understanding every
possible natural-language condition. Existing complete records benefit at
runtime; isolated old chunks missing a neighbouring condition need rebuilding
through normal ingestion to obtain the expanded parent metadata.

## Answer accuracy safeguards (2026-11-12)

- Document identifiers use one ASCII-boundary parser throughout retrieval,
  follow-up resolution, rewriting and grounding. Thai text touching a code
  (`INV-015ราคาเท่าไร`) no longer disables identity checks. Generated search
  alternatives must preserve the requested identifiers as well.
- Explicit branch/model/shift conflicts are checked before semantic relevance
  or direct section answers. Qualified section answers retain their heading so
  a branch-specific procedure is not presented as a universal procedure.
- Grounding preserves complete restrictive clauses (including receipt/member
  requirements and English negation), not just the presence of a keyword.
- New ingestion keeps the complete original atomic record in metadata when it
  needs multiple search chunks, up to 4,000 characters. Retrieval restores and
  deduplicates that record before constructing model context or citations. Larger
  fragmented records are marked incomplete and cannot be published as complete
  answers. This metadata requires rebuilding existing knowledge through the
  normal publication flow; deployment cannot recover missing text from old
  fragments. No production index was rebuilt as part of this code change.
  Sections with a separately listed requirement also retain their bounded full
  scope. For existing indexes, retrieved requirement siblings in the same source
  section participate in validation even when the model cites only an assertion.
- LINE small talk matches a whole utterance. A question with a greeting or
  thanks now continues to RAG instead of receiving only a canned response.

Regressions: `test_condition_accuracy`, `test_qualifier_accuracy`,
`test_identifier_accuracy`, and `test_line_question_routing`.

## Reported document and follow-up cases (2026-11-10)

Bounded exact lookups now cover unique explicit price/duration facts and weekday
times, plus exact section-title requests. They return original evidence with its
conditions and citations through the existing grounding validation. The Chroma
lookup scans at most 401 records and declines this shortcut when the index has
more than 400; ambiguous evidence continues through normal retrieval. This is
not a general replacement for semantic search or a model-quality improvement.

Identifier follow-ups use preceding user questions, never preceding bot answers,
to recover the requested record. CSV answers also check requested field labels
for supported field intents instead of treating an identifier match alone as an
answer. Regression coverage is in `test/test_direct_document_answers.py`.

The web chat's three-minute timer now displays a processing notice while keeping
the original request active. Starting a new chat, switching bots and leaving the
page still cancel it. This avoids discarding a response arriving after 180
seconds; it does not accelerate model startup or recover a lost connection.
There is no new automatic retry or hard client deadline.

## Explicit categories (2026-11-06)

Ingestion now recognizes explicit `หมวดหมู่: ชื่อหมวด` headings. Item evidence
retains its parent category; bounded, unpaged category sections also get a
complete overview record. Exact requests such as `ขอรายละเอียดอาหารจานหลัก`
or `อาหารจานหลักมีอะไรบ้าง` read that record from the selected bot's published
Chroma index before rewriting, embedding or reranking. The full original text
passes the existing grounding checks and retains a source citation.

This path requires a unique category record, at most 4,000 characters, and no
extra item/price constraints. Paged documents, oversized sections, ambiguous
records, unknown categories and paraphrases continue through normal retrieval;
the fast path does not infer category membership or reduce relevance thresholds.
More than 80 category records disables the bounded exact lookup. Category
requests do not need to load embedding models; vector search still loads them
on demand.

Existing indexes need rebuilding through the normal bot knowledge publication
flow to gain category metadata. Code deployment alone cannot update old chunks.
Test coverage: `python -m unittest test.test_category_retrieval`, including a
temporary real Chroma index, source grounding and bot isolation without model
calls. Rebuilding production data is separate from these regression tests.

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
