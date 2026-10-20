# Lintel

**A calm business operations platform for interior design and architecture studios.**
Projects, configurable workflows, a daily work planner, deliverable approvals,
leave and capacity, durable reminders and escalations, transparent rewards and an
owner command center — on the web and on iOS/Android.

> Make the right action the easiest action.

## What is inside

| Path | What |
|---|---|
| `apps/api` | NestJS 11 API — ts-rest contract, sessions, authorisation, use cases |
| `apps/worker` | Temporal worker + transactional-outbox relay (reminders, escalations, push) |
| `apps/web` | Next.js 16 web app (Tailwind 4, Motion) |
| `apps/mobile` | Expo SDK 58 React Native app for iOS and Android |
| `packages/domain` | Pure business rules (task states, priorities, health, leave, capacity, rewards) |
| `packages/application` | Use cases and ports |
| `packages/database` | PostgreSQL 17 schema, migrations, repositories, read models (Drizzle) |
| `packages/api-contracts` | Shared ts-rest + Zod contracts |
| `packages/integrations` | MSG91, RustFS (S3), Firebase Cloud Messaging, Temporal adapters |
| `packages/design-system` | Design tokens + web components ("Linen & Cyanotype") |
| `packages/configuration`, `packages/shared` | Validated environment; errors, dates, money |
| `infrastructure/` | Docker Compose, scripts (file-size and boundary checks, backups) |
| `docs/` | Vision, requirements, architecture, ADRs, design, security, operations |

## Quick start (local, no external accounts needed)

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm build
DATABASE_URL=postgres://lintel:lintel-local-only@127.0.0.1:5450/lintel pnpm db:migrate
DATABASE_URL=postgres://lintel:lintel-local-only@127.0.0.1:5450/lintel pnpm db:seed
pnpm dev
```

Open http://localhost:3100 and sign in with `+91 90000 00001` (owner) — the
development code is `123456`. Other fictional people use `…00002` to `…00010`
(administrator, project managers, team lead, designers, site supervisor).
API docs: http://localhost:4100/docs. Temporal UI: http://localhost:8240.

## Quality gates

```bash
pnpm check     # Biome lint + ≤250-line files + package boundaries + typecheck + unit tests
pnpm test:integration
```

## Documentation

- Product: [vision](docs/PRODUCT_VISION.md) · [requirements & business rules](docs/PRODUCT_REQUIREMENTS.md) · [design references](docs/DESIGN_REFERENCES.md) · [design system](docs/DESIGN_SYSTEM.md)
- Engineering: [architecture](docs/ARCHITECTURE.md) · [decisions](docs/DECISIONS/README.md) · [database](docs/DATABASE.md) · [security](docs/SECURITY.md) · [integrations](docs/INTEGRATIONS.md) · [operations](docs/OPERATIONS.md)
- Planning: [implementation plan & progress](docs/IMPLEMENTATION_PLAN.md) · [AI in Phase 2](docs/AI_PHASE_TWO.md)
- Contributors and coding agents: [AGENTS.md](AGENTS.md)

## Status

Phase 1 is under active construction. See
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for what is done,
verified, in progress, or blocked on external accounts (MSG91, Firebase/APNs,
app-store signing).
