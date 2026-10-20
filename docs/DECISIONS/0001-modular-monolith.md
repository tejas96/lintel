# 0001 — Modular monolith with an outbox and Temporal

**Context.** A single studio (tens of people, hundreds of projects) needs reliable
reminders, escalations and approvals, and a small team must maintain the system.

**Decision.** One NestJS API process and one worker process over one PostgreSQL
database, with explicit module boundaries enforced in code. Durable asynchronous
work uses a transactional outbox plus Temporal workflows. No microservices, broker
or event sourcing.

**Consequences.** Simple deployment and debugging; one transaction can cover a
business change and its events. Scaling is vertical plus more API/worker replicas
(the outbox relay uses `FOR UPDATE SKIP LOCKED`). Splitting a module out later
would follow the existing port boundaries.
