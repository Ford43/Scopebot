# Safe knowledge updates

Adding documents keeps the published knowledge available. Builds use an immutable
snapshot of the bot's assigned library files, create a new Chroma directory, verify
stored chunks, and publish its path in one database transaction. A failed build
never replaces the serving index. Removing or replacing documents blocks answers
until the current revision is rebuilt, so withdrawn information is not served.

## Deployment

1. Stop the old API before upgrading; old code must not run alongside new writers.
2. Install `requirements.txt` and run `alembic upgrade head` against the configured
   application database. Docker's existing startup command runs this migration.
3. Start the API and deploy the updated frontend. Legacy indexes remain usable at
   `VECTOR_DB_PATH/<bot_id>`; there is no forced rebuild of existing active bots.
4. For a bot already left inactive by a previous failed upload, use the existing
   **ลองประมวลผลใหม่** action. The UI reports a failed update and permits retry.

All API processes for an installation must share the same database, uploaded
library files and `VECTOR_DB_PATH` volume. Relative vector paths resolve against
the repository/application root. Cross-process file locks under `.locks` serialize
short mutations and per-bot builds. Committed queued/interrupted jobs resume on
API startup; duplicate recovery attempts coalesce under the same build lock.

## Lifecycle and diagnostics

- Builds live in `VECTOR_DB_PATH/.generations/<bot_id>/<job_id>/index`.
- Child output goes to the adjacent `ingest.log` in UTF-8, including on Windows.
- At 180 seconds the parent terminates the child, waits up to five seconds, then
  kills and waits if necessary. Only the parent publishes after the child exits.
- Document revisions prevent an outdated build from publishing after another
  upload, removal, replacement or bot deletion. Newer changes trigger a rebuild
  from the latest assigned documents.
- Empty, unreadable or unsupported assigned files reject the entire candidate
  build; the bot never reports a partially built knowledge base as successful.
- Old/failed index directories are retained, including after bot deletion. This
  avoids deleting Chroma files held open by concurrent readers on Windows.
  Bot/database readiness checks revoke access; automatic index cleanup is outside
  this change. Snapshot document copies are removed when a worker finishes.
- `knowledge_update_status` is `idle`, `queued`, `processing`, `ready` or `error`.
  `knowledge_update_error` explains failed updates; `has_usable_knowledge` controls
  both LINE and web readiness. Availability remains separate from update status.

## Verification

Run `.venv/Scripts/python.exe -m unittest discover -s test -p 'test_*.py'` and
`npm run build`. HTTP tests require local loopback support. Chroma integration
tests use local deterministic embeddings in a temporary directory and exit the
child before cleanup; they do not download a model or send real LINE messages.

Coverage includes additive failure/timeout, destructive failure, stale builds,
concurrent/duplicate jobs, restart recovery, legacy index resolution, migration
defaults, child termination and UTF-8, LINE/web readiness, and real Chroma reads
from both old and newly published indexes.
