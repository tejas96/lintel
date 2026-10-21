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

Optional demo data (6 realistic fictional projects, a reward policy):
`DATABASE_URL=… pnpm --filter @lintel/database db:seed:demo`.

Open http://localhost:3100 and sign in with `+91 90000 00001` (owner) — the
development code is `123456`. Other fictional people use `…00002` to `…00010`
(administrator, project managers, team lead, designers, site supervisor).
API docs: http://localhost:4100/docs. Temporal UI: http://localhost:8240.

### Mobile app

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:4100 pnpm ios      # development build on the iOS simulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:4100 pnpm android   # Android emulator
```

Setup, push notifications and release signing: [apps/mobile/README.md](apps/mobile/README.md).

### Screenshots

Web: `docs/screenshots/web/` · Mobile: `docs/screenshots/mobile/` (captured from the
running apps against the demo data).

## Quality gates

```bash
pnpm check     # Biome lint + ≤250-line files + package boundaries + typecheck + unit tests
pnpm test:integration   # needs a migrated and seeded DATABASE_URL (pnpm db:migrate && pnpm db:seed)
```

## Documentation

- Product: [vision](docs/PRODUCT_VISION.md) · [requirements & business rules](docs/PRODUCT_REQUIREMENTS.md) · [design references](docs/DESIGN_REFERENCES.md) · [design system](docs/DESIGN_SYSTEM.md)
- Engineering: [architecture](docs/ARCHITECTURE.md) · [decisions](docs/DECISIONS/README.md) · [database](docs/DATABASE.md) · [security](docs/SECURITY.md) · [integrations](docs/INTEGRATIONS.md) · [operations](docs/OPERATIONS.md)
- Planning: [morning handoff](docs/HANDOFF.md) · [implementation plan & progress](docs/IMPLEMENTATION_PLAN.md) · [AI in Phase 2](docs/AI_PHASE_TWO.md)
- Contributors and coding agents: [AGENTS.md](AGENTS.md)

## Status

Phase 1 is built and verified locally: API, worker, web and mobile, including the
gap-closure features (setup, leave and working-week settings, reports, documents,
handovers, template updates, SMS/email/web-push channels). Real SMS, push and email
delivery, store releases and the production server wait on external accounts
(MSG91, Firebase/APNs, an SMTP server, Apple/Google, Oracle Cloud). See
[docs/HANDOFF.md](docs/HANDOFF.md) and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
