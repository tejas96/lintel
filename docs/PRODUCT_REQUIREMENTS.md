# Product Requirements — Phase 1

Status of each requirement is tracked in `IMPLEMENTATION_PLAN.md`. Business rules
below are implemented in `packages/domain` and are the single source of truth;
this document explains them in plain language.

## 1. Roles and permissions

Roles: owner, administrator, project manager, team lead / reviewer, employee, site
supervisor. Permissions are **capabilities** (`packages/domain/src/identity/capabilities.ts`),
mapped to roles in the `role_capabilities` table and editable by people holding
`roles.manage`. The owner role always keeps every capability. Defaults:

| Capability group | Owner | Admin | PM | Lead | Employee | Site |
|---|---|---|---|---|---|---|
| Settings, users, roles, audit | ✓ | ✓ | | | | |
| Create projects, manage templates | ✓ | ✓ | ✓ | | | |
| See every project | ✓ | ✓ | | | | |
| Assign tasks (own projects) | ✓ | ✓ | ✓ | ✓ | | |
| Review deliverables | ✓ | ✓ | ✓ | ✓ | | |
| Approve scope changes | ✓ | ✓ | | | | |
| Approve leave (team / any) | ✓ / ✓ | ✓ / ✓ | ✓ / | ✓ / | | |
| Capacity (team / all) | ✓ / ✓ | ✓ / ✓ | ✓ / | ✓ / | | |
| Rewards: see all, decide | ✓ | | | | | |
| Command center | ✓ | ✓ | scoped to managed projects | | | |
| Site updates | ✓ | ✓ | ✓ | | | ✓ |

Project-scoped access is a second check: a person sees a project when they hold
`projects.view_all`, manage it, own it, or are a member. Missing and forbidden
records both answer **404** so IDs cannot be probed.

## 2. Identity and sign-in (FR-ID)

- Phone + OTP via MSG91 (production) or the local development provider.
- Codes: 6 digits, 5-minute expiry, single use, max 5 wrong attempts, stored only
  as HMAC-SHA-256 hashes. Resend cooldown 30 s.
- Abuse limits (PostgreSQL fixed windows, survive restarts): 5 requests per phone
  per hour, 30 per IP per hour; 10 verifications per phone and 60 per IP per 15 min.
- The response to "send code" is identical for unknown numbers; codes are only
  delivered to active accounts. Verification failures use one generic message.
- Sessions are opaque 256-bit tokens; only their hash is stored. Web: HttpOnly
  `SameSite=Lax` cookie + double-submit CSRF token. Mobile: bearer token in the OS
  secure store. Web sessions last 30 days, mobile 90; deactivation revokes all.
- People edit their own name, email and designation (Account, web and mobile;
  `PATCH /v1/me/profile` with the version). Role, phone number, status, team, manager
  and capacity stay with administrators; the API refuses those fields outright.
- A new installation is set up once with `setup:studio` (settings, studio week, role
  access, owner; no demo data), see `OPERATIONS.md`.

## 3. Projects, templates and workflows (FR-PRJ)

- A project has client details, type, criticality, owner, manager, members with
  project roles, planned start/end, a **baseline end date that never changes**,
  stages, milestones, tasks, deliverables, activity and scope-change history.
- Templates are versioned documents (stages → milestones → tasks with durations,
  dependencies, checklists, deliverables, review roles, escalation). Published
  versions are immutable; projects keep the version they started from.
- Optional stages: a template declares options (e.g. "studio also executes on
  site"); a stage with `requiresOptions` is only created when chosen.
- Plan building: each task starts the working day after its latest prerequisite
  and lasts `durationDays` working days on the studio calendar (holidays and
  non-working weekdays skipped). A milestone is due when its last linked task is due.
- Scope changes are proposed with a computed impact (moved tasks, downstream tasks,
  project end impact), approved by `scope_changes.approve`, and applied with a full
  `task_schedule_changes` history. Original commitments are never overwritten.

## 4. Tasks (FR-TSK)

States: Draft → Ready → In progress → In review → Done, with Blocked, Changes
requested and Cancelled. Legal moves are in `task-status.ts`; each move is guarded
(`task-transition.policy.ts`):

| Move | Who | Conditions |
|---|---|---|
| Draft → Ready | owner or manager | owner and due date set |
| → In progress | owner, collaborator, manager | prerequisites done; blockers resolved when resuming |
| → Blocked | participant | a reason (via "report blocker") |
| → In review | owner or manager | review required, reviewer set, required checklist done, required deliverables submitted |
| In review → Done | reviewer or manager | — |
| → Changes requested | reviewer or manager | a note |
| In progress → Done | owner or manager | no review required, checklist + deliverables complete |
| → Cancelled, reopen Done | manager | a note |

The API returns every possible move with `allowed` and the reasons, so the apps
can disable actions and explain why.

Work sessions (start, pause) exist only while the studio tracks working time
(Settings, Studio). When it is switched off, running sessions end (their minutes are
kept), start and pause answer 422 with an explanation, and the apps show Start as a
plain move to In progress with no timer. Completing a task never approves its
deliverables, and approving a deliverable never completes its task.

Dependencies are finish-to-start inside a project; loops are refused.

## 5. Daily work planner (FR-DAY)

Deterministic strategy `deadline-aware-v1` (`task-priority.strategy.ts`). Points:

| Signal | Points |
|---|---|
| Priority urgent / high / medium / low | 40 / 25 / 12 / 0 |
| Overdue | 35 + 2 per day late (max +10) |
| Due today / tomorrow / ≤3 days / ≤7 days | 30 / 22 / 15 / 8 |
| Blocks work for a milestone due within 7 days | 10 |
| Other tasks waiting on it | 4 each (max 12) |
| Project criticality critical / high | 10 / 6 |
| Changes requested by a reviewer | 8 |
| Already in progress | 5 |

Blocked tasks, tasks waiting on prerequisites and tasks in review score 0 and sit
in their own sections. Ties: earlier due date, then title. The headline uses the
strongest reason ("Recommended because it blocks work for 'Concept approved', due
tomorrow."). The score is a policy, not a truth: weights are documented and the
strategy is replaceable.

## 6. Project health and milestone risk (FR-HLT)

- Milestone **missed**: past due and not complete. **At risk**: a linked open task
  is scheduled after the milestone, or — within 7 days of it — any linked task is
  blocked or overdue.
- Project **off track** when any reason is critical: a missed milestone; ≥3 overdue
  tasks or ≥20 % of open tasks overdue; open work scheduled past the planned
  delivery date. **At risk** for any other reason: milestones at risk, any overdue
  task, blockers open ≥2 days. Otherwise **on track**. Draft = not started;
  completed/cancelled/archived = closed. Every status lists its reasons.

## 7. Capacity (FR-CAP)

Available minutes per day = calendar working minutes × capacity % − approved
leave (half days count half). The calendar is the person's working week: the studio
week (Settings, Working week: working days, start and end of the day, working
minutes) or another week assigned under People (part-timers, a site team). Studio
holidays apply to every week. Capacity, plans, leave days and reminders read the
calendar when they run, so edits apply from then on; dates already planned stay. Pending leave is shown, not subtracted. Each open
task's remaining effort (estimate − logged minutes; 120 min assumed and flagged
when missing) is spread evenly over the person's working days from today (or its
start) to its due date; overdue work lands on today. Draft tasks are tentative;
blocked work is shown separately. Load ≥85 % = stretched, >105 % = overloaded.

## 8. Leave (FR-LV)

- Full days, or a half day (single-day requests). Only working days count.
- Blocking problems: overlapping own request, missing reason (if the type needs
  one), half day not allowed. Warnings only: short notice, exceeding the configured
  allowance, critical work during the leave. **Leave is never rejected by software.**
- Approval: level 1 = the person's manager; level 2 (owner or an administrator)
  when the request exceeds the configured threshold (default 10 half-days) or
  critical work is affected. Optimistic versions prevent double decisions.
- Conflicts: milestones due, tasks due, tasks scheduled during the leave; severity
  critical for milestones, critical projects and urgent/high deadlines.
- Urgent absence: recorded by a manager, triggers reassessment notifications;
  tasks are **never reassigned automatically** — handovers are proposed,
  accepted, then applied by a manager with an audit record.
- Leave types and allowances are configurable examples; statutory entitlements
  must be verified by the studio for its jurisdiction. Holders of
  `leave.manage_policies` manage them in Settings, Leave: name, description, colour,
  needs a reason, half days allowed, minimum notice (0–90 days, a warning only),
  yearly allowance (half a day to 365 days) or none, and the second-approval
  threshold. Types are retired, never deleted: a retired type cannot be chosen for new
  requests, while requests already made with it are decided, answered and cancelled
  as usual. At least one type always stays offered.

## 9. Deliverables and approvals (FR-DLV)

Versioned deliverables (every submission kept), reviewer assignment, approve /
changes requested / reject with a reason, no self-review, approval history. Files
are validated by content (not by extension), stored in RustFS under random keys,
size-limited, and served only after an access check.

## 10. Rewards (FR-RWD)

Policies (individual or team, monthly or quarterly) combine criteria that must
all pass: on-time delivery rate, first-pass approval rate, milestones delivered on
time, early blocker reporting, collaboration, checklist compliance, improvement
over the previous period. Each criterion needs a minimum sample before it can pass.
"On time" uses the latest *approved* due date and excludes working days spent
waiting on clients, suppliers or manager decisions. Evaluations are unique per
policy, subject and period (no duplicates), store their evidence, need a manager
decision, and record adjustments with reasons. Amounts are visible only to the
person and to holders of `rewards.view_all`. Rewards are separate from payroll.

## 11. Notifications and escalations (FR-NTF)

In-app always; push (FCM) when a device is registered and the person allows it;
SMS only for urgent kinds when explicitly enabled. Quiet hours (default 21:00–08:00)
defer non-urgent push. Every notification has a dedupe key, so retries never spam.
Sensitive kinds (rewards, leave decisions) use a generic lock-screen preview.
Deadline timeline per task: reminder on the working day before (10:00), overdue
at the end of the due day, project manager after N working days overdue (template
setting, default 1; the project manager can change it per task, 1–30, and the
deadline workflow re-plans at once), business owner two working days later for urgent work or
critical projects. Durable timers run in Temporal; the database stays the source of truth.

## 12. Command center (FR-CMD)

Active / at-risk / off-track projects, overdue, blocked and due-today tasks,
pending approvals, on-time delivery rate (with sample size and previous period),
projects needing attention, upcoming milestones, critical tasks today, blockers,
approvals, team availability and overload, leave and scope decisions waiting,
8-week trend, reward summary (restricted). Filters: date range, project, manager,
team. Every item links to its record.

## Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Backend-enforced authorisation, CSRF, rate limits, redacted logs, hashed secrets, private files — see `SECURITY.md` |
| Reliability | Transactional outbox, idempotent workflow IDs, retry-safe activities, optimistic concurrency |
| Time | Instants in UTC; schedules as calendar dates in the business timezone (default Asia/Kolkata) |
| Money | Integer minor units + currency code |
| Accessibility | WCAG 2.2 AA contrast, keyboard, labels, reduced motion, ≥44 px targets, status never by colour alone |
| Maintainability | Strict TypeScript, ≤250-line files, enforced package boundaries, tests per layer |
| Performance | p95 < 300 ms for list/detail endpoints at studio scale (hundreds of projects, tens of thousands of tasks) |
| Portability | Runs locally with no external accounts; production adapters selected by validated configuration |
