# Contextual semantic retrieval

`SEMANTIC_SEARCH_ENABLED=true` (default) enables the same retrieval flow for
Chroma and Qdrant; existing indexes and their page metadata need no rebuild.

1. Local Ollama rewrites a standalone question using up to three preceding user
   questions. Previous bot answers are not treated as document facts. The
   original query is always retained alongside at most two alternative queries.
   Invalid output, introduced numbers, changed explicit shifts, and altered
   branch/model/code constraints fall back to the original question.
2. Search the bot's published index for candidate passages using each query.
   Deduplicate by source/page/text and keep the best distance for fallback.
3. `BAAI/bge-reranker-v2-m3` jointly scores the resolved question and each passage.
   CPU inference is serialized in small batches; the model is cached per API
   process. Scores are sigmoid-normalized relevance scores, not calibrated
   probabilities. `RERANK_MIN_SCORE=0.35` is an initial threshold to evaluate on
   the project's Thai question set.
4. Relevant section overviews expand only within the same source and section.
   Runtime relevance marks are never accepted from stored document metadata.
   Complete quoted sections or model answers still pass exact citation and
   factual-token validation. Explicit shift constraints remain enforced.

Query rewriting has a 20-second request timeout and falls back to the original
question if unavailable. Reranker errors log an explicit warning and use the
older distance/lexical safeguards; unchecked candidates are never marked as
semantically approved. `SEMANTIC_SEARCH_ENABLED=false` restores the old path.

The reranker requires approximately 2.3 GB of model files. Download it before
exposing a new API process to users:

```powershell
python -c "from huggingface_hub import snapshot_download; snapshot_download('BAAI/bge-reranker-v2-m3', allow_patterns=['*.json','*.safetensors','*.model'])"
```

The API loads cached model files only, so a missing cache does not trigger a
large download during a chat request. It adds CPU time and RAM requirements.
The embedding and generation models remain unchanged. Configure
`RERANKER_MODEL` only with a compatible multilingual cross-encoder.

Regression tests mock external model boundaries. Real acceptance testing must
also cover Thai paraphrases, short follow-ups, topic changes, unknown services,
conflicting shifts and citations with page numbers on both backends.

Reference: [BAAI reranker model card](https://huggingface.co/BAAI/bge-reranker-v2-m3).
