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

## Model overview (55 tables)

- **Organisation & identity:** `organization_settings` (single row), `working_calendars`,
  `calendar_holidays`, `teams`, `users`, `role_capabilities`, `otp_challenges`,
  `rate_limit_counters`, `sessions`.
- **Templates:** `workflow_templates`, `workflow_template_versions` (immutable once published).
- **Projects:** `projects`, `project_members`, `project_stages`, `milestones`,
  `scope_change_requests`, `scope_change_task_impacts`, `scope_change_new_tasks`
  (tasks a change adds; linked to the created task on approval),
  `scope_change_task_cancellations` (applied or skipped with the reason),
  `project_template_updates` (each move to a newer template version, with a JSON summary).
- **Tasks:** `tasks` (with `parent_task_id`), `task_dependencies` (no self-loops by
  CHECK; cycles refused in the domain), `task_collaborators`, `task_checklist_items`,
  `task_comments`, `task_blockers`, `task_schedule_changes`, `work_sessions`,
  `priority_conflicts`, `task_reassignment_requests` (one open per task by partial
  unique index; CHECK decided-by ≠ requested-by).
- **Files & deliverables:** `files` (metadata only — bytes live in RustFS),
  `task_attachments`, `deliverables`, `deliverable_versions`, `site_updates`, `site_update_photos`,
  `project_documents` (the project library; visibility lives on the file row so the
  content route enforces it; archived documents keep their row and object).
- **Leave:** `leave_types`, `leave_requests` (CHECK end ≥ start), `leave_approval_steps`, `leave_handovers`.
- **Rewards:** `reward_policies`, `reward_evaluations` (unique per policy + subject + period).
- **Notifications:** `notifications` (unique per recipient + dedupe key),
  `notification_deliveries` (one per channel), `notification_preferences`, `device_tokens`.
- **Platform:** `activity_events`, `audit_log`, `outbox_events`, `idempotency_records`, `workflow_runs`.
- **Finances:** `project_cost_entries` (the cost ledger: date, category enum, amount in
  minor units > 0 by CHECK, currency, note; never edited or deleted — voided with
  `voided_at`/`voided_by_user_id`/`void_reason` and a `version`). Profitability is
  switched on by `organization_settings.profitability_enabled` (default false).

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
  real project-creation use case with dates relative to today, plus completed history
  for the reports (run once, keyed on the first finished demo project): two finished
  projects, realistic on-time and late completions, backdated milestone sign-offs,
  logged work sessions, five months of leave, reviewed deliverables, decided scope
  changes and a cost ledger per project. Demo history files are metadata only (no
  bytes in object storage), so downloading one answers 404.
- Production uses neither seed. `setup:studio` (`dist/setup/setup-studio.cli.js`, also in
  the `migrate` image) creates the settings row, the default working calendar, the
  role→capability grants and the owner in one transaction and refuses once any of them
  exists (see `OPERATIONS.md`, production step 5).

## Administration tables

- `leave_types` and `working_calendars` carry a `version` (migration
  `0003_studio_administration`). Leave types are never deleted: retiring sets
  `is_active = false`, and existing requests keep pointing at the type.
- `working_calendars.is_default` marks the studio week. `users.working_calendar_id`
  null means "follows the studio week". Holidays are stored on the default calendar
  and apply to every working week.
- `organization_settings.work_tracking_enabled` is enforced by the work-session
  commands; switching it off ends running sessions.
- `tasks.escalate_after_overdue_days` is editable per task by its project manager.

## Planning flexibility (migration `0006_planning_flexibility`)

- `tasks.due_time` — optional `"HH:mm"` in the business timezone (CHECK: needs a due date
  and a 24-hour time). `task_schedule_changes.previous_due_time` / `new_due_time` keep the
  times around a move.
- `scope_change_requests.cost_impact_minor` (> 0), `cost_category`, `fee_impact_minor`
  (≠ 0, signed) and `requires_client_sign_off`. `scope_change_client_sign_offs` is
  append-only (who confirmed, `method` enum meeting/email/call/message, `confirmed_on`,
  note, who recorded it and when); the latest row counts.
- `scope_change_task_impacts.current_start_date`, `proposed_start_date` and
  `applies_exact_dates` (true for timeline drags: approval sets the proposed dates).
- `project_cost_entries.scope_change_id` links the cost entry an approval writes (partial
  unique index: at most one per scope change).
- `user_guidance_tips (user_id, tip_key, seen_at)` — first-run tips each person has seen.

## Integration tests

A second database `lintel_test` is created by `infrastructure/docker/postgres-init`.
Integration tests run migrations against it and clean up their own rows.
