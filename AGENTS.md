# AGENTS.md — rules for anyone (human or AI) changing this repository

Lintel is a business operations platform for interior design and architecture
studios. Modular monolith in a pnpm + Turborepo monorepo. Read
`docs/ARCHITECTURE.md` for the why; this file is the how.

## Layout and dependency rules (enforced by `pnpm check:boundaries`)

| Package | Holds | May import |
|---|---|---|
| `packages/shared` | errors, calendar dates/timezones, money, phone, `Patch` | nothing internal |
| `packages/domain` | pure business rules (states, priorities, health, leave, rewards, notification policy) | shared |
| `packages/application` | use cases (`*.command.ts`, `*.query.ts`) + ports (`*.store.ts`, `ports/`) | shared, domain |
| `packages/database` | Drizzle schema, migrations, repositories (implement ports), read models (`queries/`) | shared, domain, application |
| `packages/integrations` | MSG91, RustFS, FCM, Temporal, crypto adapters | shared, domain, application |
| `packages/api-contracts` | ts-rest contracts + Zod schemas | shared, domain |
| `packages/configuration` | validated environment | shared |
| `packages/design-system` | tokens (platform-neutral) + web components | shared, domain |
| `apps/api` | NestJS: thin ts-rest controllers, presenters, module wiring | everything above |
| `apps/worker` | Temporal worker + outbox relay | packages only |
| `apps/web` | Next.js app (calls the API via the contract) | api-contracts, design-system, shared, domain |
| `apps/mobile` | Expo app (calls the API via the contract) | api-contracts, design-system tokens, shared, domain |
| `apps/e2e` | Playwright browser journeys + axe accessibility checks | database (its migrate/seed scripts only); drives the built apps |

- Domain code has no framework, SDK or Zod imports.
- Write side: controller → application command → stores (ports) inside `uow.transaction(...)`.
- Read side (CQRS-lite): controller → read model in `packages/database/src/queries/<module>/` returning
  JSON-ready "view" records that already match the contract shape.
- Every project-scoped read and write checks access with `ProjectAccessService`
  (missing and forbidden both answer 404). Organisation-wide actions check a capability.
- Business changes write activity/audit/outbox rows in the same transaction (`stores.records`).
- Notifications go through `Notifier` (dedupe key required, quiet hours respected).

## Hard rules

- **≤ 250 lines per handwritten file** (`pnpm check:file-size`). Split by responsibility, never by line-packing.
- Strict TypeScript; no `any`, no `@ts-ignore`, no non-null `!`. Use `Patch<T>` + `definedOnly` for partial updates.
- Descriptive names (`approve-leave-request.command.ts`), never `utils2.ts`/`misc.ts`/`helpers.ts`.
- Validate untrusted input with Zod at the edge (the contract does this for HTTP).
- Optimistic concurrency: mutable rows have `version`; updates use `where version = expected` and throw `StaleVersionError`.
- Money is integer minor units. Instants are `timestamptz` (UTC). Schedules are calendar dates in the business timezone.
- Never log OTP codes (except the local dev provider), tokens, cookies or secrets.
- No AI calls in Phase 1 (`AI_FEATURES_ENABLED` must stay false).
- Do not pull new Docker images without checking `docker images`; never touch other projects' containers/volumes.

## NestJS + ts-rest gotchas

- Controllers: `@TsRestHandler(apiContract.<module>)` + `tsRestHandler(contract, {...})`; import `apiContract` from `apps/api/src/contract.ts`.
- **Never inject `@Res()` into a multi-route handler** — the response never completes. Use a single-route handler for that route.
- Public routes need `@Public()` (single-route handlers only). Everything else requires a session.
- Get the actor with `@Ctx() context: RequestContext`.
- Interfaces have no runtime token: inject ports with the symbols in `apps/api/src/infrastructure/tokens.ts`.
- Responses are validated against the contract (`validateResponses: true`): return ISO strings, not `Date`s.

## Commands

```bash
pnpm infra:up                      # PostgreSQL 17 :5450, RustFS :9110/:9111, Temporal :7240 (UI :8240)
pnpm db:migrate && pnpm db:seed    # needs DATABASE_URL (see .env.example)
pnpm build                         # turbo build (packages emit CommonJS + .d.ts to dist/)
pnpm --filter @lintel/api start    # API on :4100 (docs at /docs); run with --env-file=../../.env
pnpm check                         # lint + file size + boundaries + typecheck + unit tests
pnpm test:e2e                      # browser journeys + axe (own database lintel_e2e; rebuilds apps/web/.next — stop :3100 first)
```

Mobile: after adding a screen under `apps/mobile/src/app`, restart Metro (`CI=1` runs without a file
watcher) so typed routes and the bundle include it.

Local sign-in: phone `+91 90000 00001` (owner) … `00010`; code `123456` when `OTP_DEVELOPMENT_CODE=123456`.

## Database changes

Edit `packages/database/src/schema/*.schema.ts`, then `pnpm db:generate` (creates a reviewed SQL
migration) and `pnpm db:migrate`. Never edit an applied migration. Never use `drizzle-kit push` against
shared or production databases.
