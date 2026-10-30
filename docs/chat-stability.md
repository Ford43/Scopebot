# Chat request lifecycle

- Web sends are bound to a bot, session and generation. Switching bots, starting
  a new chat, restoring history or unmounting aborts the pending send. Late
  answers/errors cannot update the new chat or clear a newer request's typing
  indicator. Staff polling also ignores old sessions; an old pending poll does
  not block subsequent polls for a newly selected session.
- Web requests have a 180-second deadline covering the request and JSON body.
  Timeout unlocks the composer and displays an error so the user can try again.
  Cancellation does not guarantee that backend work or an already committed
  conversation is undone; requests are not automatically retried.
- `LLM_TIMEOUT_SEC` (default 120, minimum 1 second) sets the Ollama generation
  client's network timeout. The client closes on success and failure. Timeout
  follows the existing `RagUnavailableError` path, rather than being recorded as
  a successful answer. Query rewriting retains its existing 20-second timeout.
  This is a network timeout, not a hard deadline for CPU retrieval/reranking.
  Keep the frontend deadline and proxy timeouts in mind when increasing it.
- LINE reads the request body asynchronously, then runs signature verification,
  database operations, LINE SDK calls and RAG in a threadpool worker. The DB
  session is created and closed in that worker. This avoids blocking the ASGI
  event loop; it is not a durable queue and does not add webhook deduplication.

## Regression checks

`node test/run_frontend.mjs` includes controlled-network hook tests for late
answers/errors, session changes, staff polling and timeout. The hook scheduler
is isolated from a DOM; it is not a browser end-to-end test.

`python -m unittest test.test_chat_stability` checks event-loop responsiveness
and bounded generation requests with mocked model/LINE boundaries. Run using
the project's `.venv`, alongside the existing backend regression suite.
