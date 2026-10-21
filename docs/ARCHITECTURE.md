# Architecture

Lintel is a **modular monolith**: one NestJS API, one Temporal worker, a Next.js
web app and an Expo mobile app, sharing typed contracts and pure business rules
inside a pnpm + Turborepo monorepo. No microservices, no message broker, no event
sourcing — PostgreSQL plus a transactional outbox and Temporal cover every
durability need at studio scale (ADR 0001).

```
             ┌────────────── apps/web (Next.js 16) ───────────────┐
             │  ts-rest client · TanStack Query · design-system   │
             └───────────────┬─────────────────────────────────────┘
 apps/mobile (Expo SDK 58) ──┤  HTTPS  /v1/*  (cookie+CSRF or bearer)
                             ▼
┌──────────────────────── apps/api (NestJS 11) ─────────────────────────┐
│ ts-rest controllers → application commands/queries → domain rules     │
│                      ↘ read models (packages/database/src/queries)    │
│ adapters: Drizzle repos · MSG91 · RustFS · FCM · Temporal client      │
└──────┬─────────────────────┬──────────────────────┬───────────────────┘
       ▼                     ▼                      ▼
 PostgreSQL 17        RustFS (S3 API)      Temporal ◀── apps/worker
 (+ outbox_events)    project files               (outbox relay, workflows,
                                                    push delivery activities)
```

## Packages and dependency rules

See the table in `AGENTS.md`. The rules are enforced by
`infrastructure/scripts/check-boundaries.mjs` (declared dependencies and import
statements) and run in `pnpm check`:

- `domain` imports only `shared`; no framework, SDK, database or Zod code.
- `application` defines **ports** (interfaces) and use cases; it never imports
  Drizzle, NestJS, Next.js, React Native or SDKs.
- `database` and `integrations` implement application ports (hexagonal adapters).
- `api-contracts` imports nothing that touches a database.
- Apps compose everything; UI code holds no business decisions — the API returns
  decisions (e.g. allowed task transitions with reasons).

Internal packages compile to CommonJS + declarations with `tsc` (`dist/`), so the
API and worker run plain Node, Next.js and Metro consume compiled JavaScript, and
Turborepo builds dependencies first (`dependsOn: ["^build"]`).

## Request flow

1. **Contract**: `packages/api-contracts` declares every route with Zod schemas
   (`/v1` prefix, shared error shape). OpenAPI is generated from it at `/docs`.
2. **Controller** (`apps/api/src/modules/<module>`): `@TsRestHandler` validates the
   request, resolves the actor (`@Ctx()`), calls a command or read model, and
   returns a contract-shaped body. Responses are validated too.
3. **Command** (`packages/application/src/<module>/*.command.ts`): checks
   capabilities and project access (`ProjectAccessService`), loads facts through
   store ports, asks the domain for a decision, and writes inside
   `uow.transaction()` — business rows, activity, audit, outbox, notifications in
   one atomic unit.
4. **Read model** (`packages/database/src/queries/<module>`): purpose-built SQL
   returning JSON-ready views that already match the contract (CQRS-lite, because
   dashboards and lists read very differently from how commands write).
5. **Async**: the worker relays outbox rows to Temporal workflows with
   deterministic IDs; workflows sleep durably and call retry-safe activities that
   re-read the database before acting.

## Design patterns — where and why

| Pattern | Where | Why it earns its place |
|---|---|---|
| **Builder** | `ProjectWorkflowPlanBuilder` (domain/workflows) | Plans have optional stages, role→person mapping and a calendar; a fluent builder keeps creation readable and testable. |
| **Factory** | `createWorkflowTemplatePreset` (domain); `adapterFactory` (api/infrastructure) | Creation varies by project type / by configuration (MSG91 vs local OTP, FCM vs log push, fixed vs random codes). |
| **Command** | `*.command.ts` in application (RequestOtpCommand, VerifyOtpCommand, ManagePeopleCommands, …) | Each business operation is an explicit object with validation, authorisation and one transaction. |
| **Strategy** | `TaskPriorityStrategy`, `ProjectHealthCalculator`, `LeaveApprovalPolicy`, reward criteria evaluation, business health score (`health-v1`), risk card rules, cover suggestions (`cover-v1`) | Policies a studio may tune or replace without touching callers. |
| **Observer / domain events** | `DomainEvent` → `outbox_events` → worker → Temporal | Decoupled reactions (reminders, escalations, push) that must survive crashes; no in-memory event bus for critical work. |
| **Transactional outbox** | `RecordStore.enqueueEvent` + worker relay | Business change and its event commit together; the relay delivers at least once. |
| **Repository / Unit of Work** | store ports + `DrizzleUnitOfWork` | Use cases see narrow ports; one transaction spans several stores. |
| **Ports & adapters** | `OtpProvider`, `ObjectStorage`, `PushProvider`, `WorkflowScheduler`, `SecretHasher` | SDK types never leak into business code; development adapters swap in locally. |
| **Facade** | `BusinessContextService` (today in business TZ, settings, notifier) | One thin entry point for cross-cutting context. |
| **Decorator** | Nest guards/filters/interceptors (session guard, error filter, ts-rest validation, structured logging) | Cross-cutting behaviour around every request without touching handlers. |
| **Specification-like guards** | `task-transition.policy.ts` guard functions | Reusable predicates that also explain failures. |
| **Singleton (managed)** | Nest providers for DB pool, S3 client, Temporal connection | Exactly one per process, owned by the DI container — no global mutable state. |
| **Optimistic concurrency** | `version` columns | Concurrent edits and approvals fail safely with `STALE_VERSION`. |
| **Idempotency** | dedupe keys, unique reward period index, deterministic workflow IDs, `idempotency_records` | Retries never duplicate notifications, rewards or workflows. |

**Deliberately not used:** microservices, a message broker, event sourcing, a
generic CQRS framework, a generic repository for every table, inheritance-heavy
entity models, global singletons. Composition and plain functions are preferred
where a pattern would only add indirection.

## Time, money and identifiers

- Instants: `timestamptz`, serialised as ISO-8601 UTC. Calendar dates
  (`YYYY-MM-DD`) for schedules, interpreted in the business timezone from
  organisation settings (default `Asia/Kolkata`).
- Money: integer minor units + ISO currency.
- IDs: UUID v4 from PostgreSQL; human references (`ARN-2026-014`, task `#23`) for people.

## Exceptions to the 250-line rule

Generated files are excluded from `check-file-size.mjs`: SQL migrations and
Drizzle snapshots (`packages/database/migrations/**`), `next-env.d.ts`,
`expo-env.d.ts`, and native projects generated by Expo prebuild (`ios/`, `android/`).

## ts-rest note

ts-rest is in maintenance mode (latest stable 3.52.1, March 2025) and supports
NestJS ≤ 11 and Zod 3, which is why the API uses NestJS 11.2.7 and Zod 3.25.76
(ADR 0002). The contract package is isolated so a future move to ts-rest v4 or an
alternative only touches `packages/api-contracts` and the thin controllers.
