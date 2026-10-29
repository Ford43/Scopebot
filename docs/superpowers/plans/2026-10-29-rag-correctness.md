# RAG correctness repair

User authorized implementation of four diagnosed bugs, in this order. Preserve
the existing uncommitted work; implement in the current checkout without commits.

1. Grounding: reject unsupported assertions, polarity changes and reassigned
   values. Keep deterministic section/shift extraction and supported literal
   answers. Test negation, swapped prices, conditions and empty evidence first.
2. DOCX: read paragraphs and tables in document order, retaining row context.
   Test an in-memory document with paragraphs surrounding a table.
3. Completeness: retain unnumbered section identity and expand entire sections.
   Test 12-item lists, unrelated sections, second-pass stability and >80 items.
4. Context: use the same contextual question for search and reranking, including
   short warranty/price followups, and retain context when rewrite is unavailable.
   Test explicit topic changes and never use previous answers as evidence.

For each task: run new regression tests before implementation, confirm expected
failures, implement, then run existing RAG regressions. Finally run backend suite
with workspace temporary storage and UTF-8 output and request independent review.

Design choice: deterministic conservative grounding, without introducing another
model or pretending a relevance score proves a claim. Unsupported paraphrases may
be declined. Existing indexes require reingestion for new table/section metadata.

Review focus: negation substrings; conditions omitted from quotes; table headers
detached from values; section limits silently truncating; followup context lost
on rewrite failure. No changes to citation persistence (outside requested scope).

## Execution record

- Task 1: new tests failed for negation, price reassignment, invented text,
  omitted conditions and empty evidence; implemented literal-support checks.
- Task 2: table regression failed with paragraphs-only output; implemented
  ordered table reading and verified row/header association, nested tables,
  and preservation of numeric first records.
- Task 3: 12-item and >80-item regressions failed; section identity and explicit
  incomplete marking now pass, including retrieval-to-answer expansion.
- Task 4: warranty followup and rewrite-outage tests failed; shared deterministic
  context now drives ranking and search. Existing followup behavior retained.
- Independent reviewer found repeated negation, restrictions on a preceding
  line, cropped quote bypass and consecutive followup subject loss. Each was
  reproduced with a failing regression and fixed. No deferred review findings.
- Ruling: use conservative literal-support checks, not a second model claiming
  semantic certainty; unsupported paraphrases may be declined. This is documented
  for operators and the generation prompt requests original wording.
- Ruling: preserve existing checkout and uncommitted changes; no commit, merge,
  dependency installation or production reindex as part of this code repair.
- Focused regression suite: 66 tests passed after all code changes.
- Full backend discovery: 139 tests passed in 70.276s. Windows native runtime
  initialized before imports and local loopback allowed for TestClient; prior
  restricted runs stalled creating its event loop. Includes real Chroma/Qdrant
  index integration tests. Output: tmp/rag-full-suite-verified.log.
