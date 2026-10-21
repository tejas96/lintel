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
- A scope change can also **add tasks** (title, open stage, dates, an owner already on
  the project) and **cancel tasks** (open, not waiting for review, not also being
  moved). Cancelled tasks stop counting towards the end date and no longer pass
  delays on to the tasks that follow them. Approval moves the dates, creates the new
  tasks (ready when they have an owner and a due date) and cancels the others in one
  transaction; a task that closed or went to review since the proposal is left as
  it was and the reason is kept. If a new task's stage closed since the proposal,
  approval is refused (reject and propose again). Cancelling stops running timers on
  the task, cancels its unstarted subtasks and is audited per task. Nobody decides a
  change they proposed (the studio owner excepted, as before).
- **Template updates.** When a newer version of a project's template is published,
  the project manager sees a dry run: what would be added, changed and removed, and
  what will not change and why. Rules: new stages go after the nearest earlier stage
  the project has and never in front of a stage that has started; new tasks are
  scheduled from today after their prerequisites and given to whoever holds the role;
  changes apply to work that has not started, compared three ways (old template, new
  template, project) so a value the project changed itself is kept; started work,
  committed dates and the planned end change only when the manager ticks them;
  finished work, closed stages and anything in review never change; removed tasks
  are cancelled (never deleted) only when not started; a move into a new stage or
  milestone that cannot be added here is shown but never applies. Applying locks the
  project's tasks, milestones and stages, records the update
  (`project_template_updates`), schedule history for new and moved tasks, activity
  and audit (one audit row per cancelled task, running timers stopped), and points
  the project at the new version.

### Project documents (FR-DOC)

- A library per project for files not tied to a task: drawings, contracts, mood
  boards, site photos, other. Same upload rules as attachments (content-detected
  allow-list, size limit, random keys, access-checked download).
- Visibility **project** (everyone on the project) or **confidential** (project
  managers, owner, administrators, holders of `files.view_confidential`, and the
  person who added it). Confidential documents and their titles never reach anyone
  else: they are left out of lists, counts, activity text and the file route (404).
  Only people who may read confidential documents can file one.
- Filters by folder, kind and text; image previews. Archiving (by the person who added
  it or a project manager) is a soft delete: the document leaves the library, its file
  stops being served, the stored object and the audit record stay.

### Handover requests (FR-TSK-RA)

- The owner of a task, or a collaborator, asks the project manager to give it to
  someone else, with a reason and an optional suggested person. One open request per
  task (also enforced by a partial unique index).
- The project manager (or the project owner when the manager is the one asking;
  studio-wide project managers when nobody on the project can) sees it in the
  approvals queue and on the task, and may decide it. Accepting reassigns through the
  normal assignment path (audited, new owner notified, reminders restarted);
  declining needs a note. The person who asked hears either way and may withdraw an
  open request. Nobody decides their own request (also a database CHECK).

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
can disable actions and explain why. Completing a task never approves its
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
leave (half days count half). Pending leave is shown, not subtracted. Each open
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
  must be verified by the studio for its jurisdiction.

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
setting, default 1), business owner two working days later for urgent work or
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
