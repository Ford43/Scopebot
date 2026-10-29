# Incremental document deletion

Removing a document from a ready, current bot index deletes only records whose
source equals that filename. Chroma and Qdrant both verify the source has no
remaining records before the bot is marked ready. No embedding model is loaded
and surviving documents are not re-embedded. Operations remain scoped to the
bot's published index and the existing knowledge mutation lock.

This is an explicit exception to immutable generations: source deletion mutates
the current index. A query that already retrieved evidence before deletion may
still complete with that evidence; cancellation of in-flight answers is not
provided. Future retrievals cannot fetch the deleted records after success.

Pending updates, missing published paths, or deletion failures keep the existing
blocked/rebuild behavior. Removing the last document clears the active pointer.
No database migration or reingestion is needed to enable this path after restart.

Tests: `test.test_incremental_delete`, plus the document removal, knowledge update,
API regression and administration suites. Native Chroma handles may retain test
files until the test process exits on Windows.
