# Database

PostgreSQL 17, Drizzle ORM 0.45 and Drizzle Kit 0.31. Schema source:
`packages/database/src/schema/*.schema.ts`; generated SQL migrations:
`packages/database/migrations/`.

## Conventions

| Topic | Rule |
|---|---|
| Keys | `uuid` primary keys (`gen_random_uuid()`); composite keys for pure join tables |
| Names | snake_case tables and columns, explicit in the schema |
| Instants | `timestamptz`, written in UTC |
| Schedules | `date` (calendar date in the business timezone) |
| Money | `bigint` minor units + `currency` text |
| Enums | PostgreSQL enums generated from domain constants (`schema/enums.ts`) |
| Concurrency | `version integer` on mutable aggregates; updates `WHERE version = $expected`, then `+1` |
| History | never overwrite commitments: `baseline_*` dates, `task_schedule_changes`, `activity_events`, `audit_log` |
| Deletion | soft states (`archived_at`, `deactivated_at`, `status`) for business records; cascades only for owned children |
| JSON | `jsonb` only for documents that are read and written whole (template definitions, reward evidence, conflict snapshots) |

## Model overview (44 tables)

- **Organisation & identity:** `organization_settings` (single row), `working_calendars`,
  `calendar_holidays`, `teams`, `users`, `role_capabilities`, `otp_challenges`,
  `rate_limit_counters`, `sessions`.
- **Templates:** `workflow_templates`, `workflow_template_versions` (immutable once published).
- **Projects:** `projects`, `project_members`, `project_stages`, `milestones`,
  `scope_change_requests`, `scope_change_task_impacts`.
- **Tasks:** `tasks` (with `parent_task_id`), `task_dependencies` (no self-loops by
  CHECK; cycles refused in the domain), `task_collaborators`, `task_checklist_items`,
  `task_comments`, `task_blockers`, `task_schedule_changes`, `work_sessions`,
  `priority_conflicts`.
- **Files & deliverables:** `files` (metadata only — bytes live in RustFS),
  `task_attachments`, `deliverables`, `deliverable_versions`, `site_updates`, `site_update_photos`.
- **Leave:** `leave_types`, `leave_requests` (CHECK end ≥ start), `leave_approval_steps`, `leave_handovers`.
- **Rewards:** `reward_policies`, `reward_evaluations` (unique per policy + subject + period).
- **Notifications:** `notifications` (unique per recipient + dedupe key),
  `notification_deliveries` (one per channel), `notification_preferences`, `device_tokens`.
- **Platform:** `activity_events`, `audit_log`, `outbox_events`, `idempotency_records`, `workflow_runs`.

## Migrations

```bash
# after editing a schema file
pnpm db:generate          # drizzle-kit generate → reviewed SQL in packages/database/migrations
pnpm db:migrate           # applies pending migrations (drizzle migrator, advisory-locked)
```

- Migrations are committed and reviewed like code. Applied migrations are never edited.
- `drizzle-kit push` is allowed only against throw-away personal databases.
- Production runs `node packages/database/dist/migrate.cli.js` (or the `migrate`
  container) before starting new API/worker versions.
- Destructive changes follow expand → migrate data → contract across releases.

### Rollback strategy

Drizzle migrations are forward-only. Rollback = restore from backup or ship a new
forward migration that reverses the change. Therefore: take a backup before every
production migration, prefer additive changes, and keep the previous API version
compatible with the new schema for one release.

## Seeds

- `pnpm db:seed` — idempotent foundation: settings, default calendar (Mon–Sat,
  09:30–18:30, fixed-date holidays), role capabilities, three teams, ten obviously
  fictional people (`+91 90000 000xx`), example leave types, the six starter
  templates. Refuses to run with `NODE_ENV=production`.
- `pnpm --filter @lintel/database db:seed:demo` — demo projects created through the
  real project-creation use case with dates relative to today.

## Integration tests

A second database `lintel_test` is created by `infrastructure/docker/postgres-init`.
Integration tests run migrations against it and clean up their own rows.
