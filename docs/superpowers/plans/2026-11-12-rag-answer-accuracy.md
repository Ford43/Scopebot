# RAG answer accuracy implementation plan

> Execute the already-authorized audit fixes using regression tests before code changes. Preserve the current working tree and published knowledge.

**Goal:** Prevent cited but incorrect chatbot answers identified in the November 12 audit, while keeping supported answers available.

**Scope:** Conditions/negation, branch/model qualifiers, Thai-adjacent identifiers, long evidence records, and mixed LINE greetings/questions. No model switch, dependency, migration, OCR installation or production ingestion.

**Architecture:** Use shared identifier parsing at all retrieval/grounding boundaries; reject conflicting qualifiers before semantic approval; retain complete bounded source records when checking conditions. Keep the existing citation validation and deterministic answer paths.

- [x] Identifier parsing: add failing Thai-prefix/suffix, conflicting-code, and follow-up regressions; share an ASCII-boundary extractor across evidence/retriever/pipeline/semantic.
- [x] Qualifiers: add conflicting/matching branch/model/shift regressions, including semantic matches; preserve qualifiers during topic selection and section extraction.
- [x] Conditions and long records: reproduce dropped receipt/member/English negation clauses; preserve complete bounded atomic records and reject incomplete oversized evidence. Test full supported answers as well as refusals.
- [x] LINE: mixed greeting/question must reach RAG; pure greetings still work. Add regressions and fix obsolete webhook tests for the current background-task interface.
- [x] Verify relevant RAG, webhook and required backend regressions; rerun read-only eight-case acceptance if the local published index is available. Request independent code review before reporting completion.

**Review focus:** Wrong record despite high reranker score; follow-up changes identifiers; qualifiers in both parentheses and plain headings; conditions on preceding/following lines; long CSV rows; pure versus mixed greetings; unchanged bot isolation and citations.

Verification: 173 combined backend regressions passed; read-only published-index acceptance 8/8. Independent review findings resolved. No production reindex or service restart performed.
