# Authentication Audit Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Root performs independent review.

**Goal:** Audit authentication, bound repeated failures, and revoke the current login on logout.

**Architecture:** Persist rolling failure timestamps and cooldowns in keyed database rows, acquired with atomic upsert locks in sorted order. Revoke JWTs by SHA-256 hash (including legacy tokens); new tokens have unique jti. Reuse admin AuditLog and existing UI.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React/TypeScript.

**Spec:** Approved task supplied by parent: 5 failures/15 minutes, 5-minute non-extending cooldown, account and IP limits, truthful logout, admin date/account/action filters and pagination.

## Constraints and review focus
- Preserve all pre-existing changes; no real database operations, dependencies or commits.
- IP policy: 30 failures/15 minutes and 5-minute cooldown; trust only ASGI client address, configure proxy trust at server boundary.
- Unknown accounts are HMAC identifiers, never raw submitted emails; password and token values never in logs.
- Verify concurrency, exact cooldown/window boundaries, legacy and unique tokens, idempotent logout, failed writes, filtering and UI failure states.

## Tasks
- [x] Write and run failing isolated authentication tests.
- [x] Implement database models/migration, atomic limiter, audited login and revoked-token enforcement.
- [x] Extend audit filtering and UI; implement countdown and confirmed logout.
- [x] Run targeted and required backend/frontend checks; document migration and operational limits.

## Ledger
- Existing branch Ford is not protected main/master; retain it and all unrelated dirty files.
- Approved full execution supersedes another approval gate; implementation stays in current workspace.
- Initial regression run demonstrated missing 429/audit and duplicate same-second JWTs; added behavior passed targeted checks.
- Ruling: retain case-sensitive account lookup for compatibility with existing case-distinct users; only limiter keys are case-folded. Reviewer reproduction failed before the fix and passed afterward.
- Ruling: revoke canonical verified token identities, not raw token strings. Reviewer demonstrated equivalent signature encoding bypass; padding and unused-bit regression tests now pass for new and legacy JWTs, with HTTP denial after logout.
- Logout concurrent retries produce one audit event; database failure rolls back revocation/log; browser network failure preserves retry credentials and a newer login cannot be cleared by an older logout response.
- Windows restricted localhost socketpair blocked TestClient initialization. Faulthandler identified the environment failure; approved elevated regression run used only disposable test databases and completed.
- Final backend command: `.\.venv\Scripts\python.exe -m unittest test.test_review_fixes test.test_admin_platform test.test_library_delete test.test_auth_audit` — 57 tests passed. Existing SQLAlchemy delete-count/deprecation warnings and intentional mocked LLM offline output remain.
- Frontend: `node test/run_frontend.mjs` — 21 tests passed; `npm run build` passed with the existing bundle-size warning. `git diff --check` passed.
- Migration upgrade/downgrade tested on disposable SQLite, PostgreSQL upsert compilation checked. No live PostgreSQL/multi-worker integration or real migration executed. Operational rollout, proxy trust, compatibility and retention are in `docs/authentication-audit.md`.
