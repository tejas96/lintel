# 0006 — Temporal topology

**Decision.** Locally, the Temporal CLI dev server from the already-present
`temporalio/admin-tools:1.30.6` image (`temporal server start-dev` with a SQLite
file on a named volume, UI on :8240). In production, `temporalio/server` backed by
PostgreSQL (schema managed with `temporal-sql-tool`). Workers run in their own
process (`apps/worker`), never inside the API.

**Consequences.** One small container for development with persistence across
restarts. Workflow code is deterministic and only imports activity types;
activities re-read the database, so the database stays the source of truth.
The time-skipping test server is unavailable on this Apple-silicon machine
(no Rosetta), so workflow tests run against the dev server with short waits.
