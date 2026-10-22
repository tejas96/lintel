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
| Rewards: policies and milestone rewards | ✓ | ✓ | | | | |
| Command center | ✓ | ✓ | scoped to managed projects | | | |
| Reports and CSV export | ✓ | ✓ | scoped to managed projects | | | |
| Budgets and project costs (when switched on) | ✓ | ✓ | own projects | | | |
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

### Tailoring a plan before the project starts (FR-PRJ-TL)

- After choosing a template, the wizard's **Plan** step (needs a start date and the team)
  lets the person creating the project leave out stages or tasks, add stages (placed after
  a stage) and tasks (title, working days, what they start after), change a task's start
  date or length, and choose a person per task (or nobody yet). Whoever is chosen joins the
  team as a member but holds no role, so the roles' other tasks stay with the team as
  entered. A task given to its own reviewer has no reviewer yet (nobody reviews their own
  work).
- The plan builder (`packages/domain/src/workflows`) dates the result: removed work is no
  longer waited on, a chosen start wins over the one worked out from prerequisites (a start
  before a prerequisite ends is flagged, not refused), and an empty stage sits where the
  previous one ends. `POST /v1/projects/plan-preview` runs the same checks and builder as
  creating the project, so the live preview, its end date and the comparison with the
  template's own plan are exactly what is created. Tailoring problems name their field
  (`tailoring.adjustments.2.startDate`). Added stages and tasks carry no template key; the
  activity feed and audit say what was tailored.

### Scope change money and client sign-off (FR-PRJ-SC)

- A proposal may carry a **cost** (what the extra work costs the studio, > 0, with a cost
  category) and a **fee** (what the client pays more, or less as a negative amount), in
  minor units. Only people who can see the project budget may set them (others: 403) and
  only they see them; the activity feed never shows money.
- A proposal may **require the client's sign-off**. The project manager or an approver
  records who at the client confirmed it, the day and how (meeting, email, call, message)
  with an optional note; every record is kept and the latest counts. Approval is refused
  (422) until a required sign-off exists; rejecting needs none.
- Approval records the cost on the project's cost ledger (dated the approval day, linked to
  the change, at most one entry per change) and adds the fee to the budget (never below
  zero; a project without a budget keeps none). Both are audited.

### Rescheduling on the timeline (FR-PRJ-RS)

- Project managers drag a task bar to move it or drag an end to change one date; with the
  keyboard, a focused bar moves with ← →, Shift + ← → changes its end, Alt + ← → its start,
  Enter reviews and Escape cancels. Touch screens change dates from the task instead.
- Before anything is saved the server previews the knock-on (`planTaskReschedule`):
  finish-to-start, waiting work moves just far enough, slack absorbs a delay, pulling
  earlier never pulls what follows, and closed tasks never move. Dates dropped on a day off
  snap to working days; a bar moved whole keeps its length in working days. The preview
  lists the tasks that follow, milestones that would slip and the agreed end.
- Applying moves the tasks in one transaction. A committed deadline (not a draft) needs a
  reason and is kept in each task's schedule history; owners are told. A change that would
  move the **agreed end** is refused here and becomes a scope change with exact dates
  (approval applies those dates). When open work already runs past the agreed end, moves
  that end no later than it already does are allowed. A task that changed after the
  preview was worked out (dates or status) refuses the whole move with a stale-version error.

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
can disable actions and explain why.

**Due time.** A task may have a due time ("HH:mm", the studio's timezone). Without one it is
due by the end of the working day. A task due today becomes overdue once its time (or the
working day) has passed — in Today, in task lists and in the reminders. A due time needs a
due date; moving the time of a committed task follows the due-date rule (manager, reason,
history with both times).

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
| Due today at a time less than two hours away | 34 (instead of 30) |
| Due today and its time (or the working day) has passed | 35 (overdue) |
| Blocks work for a milestone due within 7 days | 10 |
| Other tasks waiting on it | 4 each (max 12) |
| Project criticality critical / high | 10 / 6 |
| Changes requested by a reviewer | 8 |
| Already in progress | 5 |

Blocked tasks, tasks waiting on prerequisites and tasks in review score 0 and sit
in their own sections. Ties: earlier due date, then earlier due time (no time = the end of
the working day), then title. The headline uses the
strongest reason ("Recommended because it blocks work for 'Concept approved', due
tomorrow."). The score is a policy, not a truth: weights are documented and the
strategy is replaceable.

## 6. Project health and milestone risk (FR-HLT)

Health is judged on the same **schedule forecast** as the risk cards (§15.2), computed once
per project (`assessProjectSchedule`, policy `rules-v2`). So a milestone or a delivery date
that a card says is late never shows as on track.

- Milestone **missed**: past due and not complete. **At risk** when either:
  - its **forecast passes its due date**: the latest forecast finish of its linked open
    tasks is after the milestone. The first reason gives the slip in working days (studio
    calendar) and the forecast date: "Forecast 1 working day late, on 2026-11-03 instead of
    2026-11-02." Linked work planned after the milestone always slips it (nothing is forecast
    to finish before its due date) and is named as the next reason; or
  - within 7 days of it, a linked open task is blocked (status or an open blocker) or
    overdue, even while the forecast still keeps the date.

  Otherwise **on track**. Completed or cancelled milestones show as completed.
- Project **off track** when any reason is critical: a missed milestone; ≥3 overdue
  tasks or ≥20 % of open tasks overdue; open work **forecast** to finish past the planned
  delivery date (the slip in working days). **At risk** for any other reason: milestones at
  risk, any overdue task, blockers open ≥2 days. Otherwise **on track**. Draft = not started;
  completed/cancelled/archived = closed. Every status lists its reasons, critical ones first.
- **Forecast end** (`forecastEndDate`: project header, project cards, timeline, phone app):
  the latest forecast finish of all open dated work, the same date as the planned delivery's
  risk card. It is never in the past (overdue work finishes today at the earliest). Null
  without open dated work.
- Example (today Wednesday 21 October): "Order counter stone" is blocked and due today, so it
  finishes Thursday at the earliest. "Install counter" waits on it, is planned from Thursday
  22 October to Monday 2 November and belongs to "Installation complete", due 2 November. It
  starts a working day later, on Friday, keeps its span and is forecast Tuesday 3 November.
  The milestone is **at risk**, 1 working day late, although it is 12 days away and none of
  its own tasks is blocked or overdue. If 2 November is also the planned delivery date, the
  project is **off track**. The risk card on the blocked task lists the milestone as also
  delayed by 1 working day.
- For unchanged work the forecast only moves later as days pass, so health does not flip
  back and forth: it goes on track → at risk → missed, or back when the work changes. The
  daily risk run (08:30) records each change and tells the project manager about milestones
  newly at risk or missed: one notification per project per day at most (sent every day while
  the project is off track).

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
blocked work is shown separately. Load ≥85 % = stretched, >105 % = overloaded. A person
with any working day in the range booked past that day's available time (work on approved
leave included) counts as overloaded ("Overloaded on 1 day"); the range's totals stay shown.

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

### 10.1 Milestone rewards

While planning, people holding `rewards.manage_policies` (owner and administrators)
attach a reward to an **open** milestone: an amount for **one person**, or **shared** by
2 to 20 people. Recipients must be active people working on the project (its members,
manager or owner). The milestone's due date at that moment is recorded as the **agreed
date**. A reward can be changed or withdrawn (with a reason the people read) until the
milestone completes; after that only a reviewer's decision settles it.

**Split rule.** A shared amount is split equally in minor units, in name order; the
remainder (amount mod people) goes one paisa each to the first people, so the shares
always add up to the amount (₹5,000.01 for two: ₹2,500.01 and ₹2,500.00;
`splitMilestoneReward`).

**Check at completion** (`assessMilestoneReward`, run in the same transaction that
completes the milestone), for each recipient:

| Condition | Met when |
|---|---|
| Required deliverables submitted | Every required, not cancelled deliverable of the milestone's (not cancelled) tasks has at least one submitted version. Met when none is required. |
| Reviews passed | Each of those deliverables is approved (its latest version). |
| Completed by the agreed date | Late working days ≤ excused working days. Late working days = the recipient's working days after the deadline up to the completion day (studio timezone). The deadline is the milestone's due date at completion, which only moves when a scope change is approved — so an approved revision replaces the agreed date. |
| Required documents on file | Each folder the planner ticked holds a project document added by the completion instant and not archived before it. Met when none is required. |

**Excused working days** = working days on the recipient's calendar on which at least one
blocker on the milestone's tasks, outside the recipient's control, was open (from the day
it was raised to the day before it was resolved, or to completion; overlaps count once).
Outside the person's control: category client, supplier or manager decision, or waiting
on a named colleague other than the person. A shared reward is judged per person, so a
wait on one recipient excuses the others but not them.

The result is a **recommendation** (grant when every condition is met, otherwise
withhold) with the evidence of each condition, and the share waits for review. A person
holding `rewards.decide` approves (optionally with a different amount, explained by the
note) or declines it, always with a note, never for their own reward. When a different
amount (or a challenge correction) takes the milestone's total past the reward's amount,
the reviewer is warned before deciding and the overrun is recorded in the audit; it is not
blocked, because a person decides rewards. Nothing is granted,
paid or deducted automatically: the proposed amount is always the full share.

Amounts: the person and `rewards.view_all` see what is proposed and granted; planners
also see the amount and planned split they set in the project. Everyone else sees no
reward on the milestone. Planning, checks, decisions and withdrawals are audited (amounts
hidden in the audit log without `rewards.view_all`); nothing goes to the project activity
feed. Recipients are told when a reward is attached, changed, withdrawn, checked and
decided; reviewers when shares wait for them (`reward_review_requested`).

### 10.2 Transparency and challenges

Rewards → My recognition (web and phone) shows each person **what earns a reward**
(every active policy with each criterion and how it is measured, and their planned
milestone rewards with the conditions in words), **what waits for review** with the
rules' findings, and **every decision** with its reasons, adjustments and challenges.

The person a record is about (for a team evaluation, any member of the team) can
**challenge** it with a reason (10 to 2,000 characters) once the outcome is known (not
eligible, approved, not approved). One challenge per record can be open at a time, and a
record can be challenged three times in all (`challengeRefusal`). Records the person may
not see answer 404.

The challenge goes to the reviewer who decided the record (or, when nobody did or they
no longer hold `rewards.decide`, to everyone who does). A reviewer — never the person who
raised it or anyone the record is about — answers with a note:

- **Uphold:** the record stands.
- **Correct:** the record is granted, or the amount granted is raised; the corrected
  amount is stored as the adjusted amount so the original stays on record. A challenge
  never lowers a reward or takes one away (`correctionProblem`).

Each challenge keeps the record's outcome when it was raised and after the answer, so
the full history is visible on the record. Raising and answering are audited, emit
outbox events and notify both ways (sensitive kinds: generic lock-screen text).

## 11. Notifications and escalations (FR-NTF)

In-app always; push (FCM) when a device is registered and the person allows it;
SMS only for urgent kinds when explicitly enabled. Quiet hours (default 21:00–08:00)
defer non-urgent push. Every notification has a dedupe key, so retries never spam.
Sensitive kinds (rewards, leave decisions) use a generic lock-screen preview.
Deadline timeline per task: a late-start nudge the working day after the planned
start while the task is still Ready (§15.4), reminder on the working day before
(10:00), overdue at the due time (or the end of the due day without one), project manager after N working days overdue (template
setting, default 1; the project manager can change it per task, 1–30, and the
deadline workflow re-plans at once), business owner two working days later for urgent work or
critical projects. Durable timers run in Temporal; the database stays the source of truth.

## 12. Command center (FR-CMD)

Active / at-risk / off-track projects, overdue, blocked and due-today tasks,
pending approvals, on-time delivery rate (with sample size and previous period;
"–" and no change badge when nothing finished in the period),
projects needing attention, upcoming milestones, critical tasks today, blockers,
approvals, team availability and overload, leave and scope decisions waiting,
8-week delivery trend (ending with the period's last week, or this week when the
period runs to today), reward summary (restricted), and the briefing of §15: the
business health score with its contributors and trend, risk cards, deadlines in the
next 7 days, performance highlights and owner intervention needed. Filters: date range, project,
manager, team. Every item links to its record.

The web filters live in the URL (`?from=&to=&project=&manager=&team=`), so a view
can be shared and Back undoes the last change; applied filters show as removable
chips. Without a period the range is the last 30 days. When profitability is on
(section 14) the command center adds budget against recorded cost.

## 13. Reports (FR-RPT)

Seven reports in the web app (Reports), each also downloadable as CSV: four about
the period (13.1–13.4) and three that learn from history (13.6–13.8). Every number
is counted from records; the formulas below are implemented in
`packages/application/src/reports/*.metrics.ts` (unit-tested) and applied by the read
models in `packages/database/src/queries/reports/`.

**Who sees what.** `dashboard.view_business` (owner and administrators) sees the
whole studio. A project manager (role, or anyone managing at least one project)
sees the same reports limited to the projects they manage; a project filter outside
them answers 404. Leave in a manager's reports is limited to the people whose leave
they may see (themselves, their direct reports and, with `capacity.view_team`, their
team). Everyone else is refused (403).

**Filters and periods.** Period (default: the last 90 days, at most 366 days),
project, manager (studio view only) and team, shared with the command center. A
team filter keeps projects whose manager or a member is in the team, and task-level
numbers to task owners in the team. Reports cover every project, including completed
and archived ones, because history matters. Ranges up to 98 days are broken down by
ISO week (Monday–Sunday), longer ones by calendar month; the first and last buckets
are clipped to the range. Calendar dates are in the studio timezone.

### 13.1 Delivery reliability

| Measure | Formula |
|---|---|
| On time | A task or milestone completed on or before its due date (the latest approved one). Completion day = the completion instant in the studio timezone. |
| Late | Completed after its due date. Days late = calendar days from the due date to the completion day. |
| Counted in the period | By completion day; work finished in the period counts even when it was due earlier. |
| Still open past due | Not completed, due inside the period and before today. Shown apart; it never enters the rate. |
| On-time rate | On time ÷ (on time + late), to 0.1 %; "–" when nothing was completed. |
| Average lateness | Sum of days late ÷ late completions, to 0.1 day. |
| Left out | Cancelled or archived tasks, cancelled milestones, tasks without a due date. |

Broken down by period (tasks and milestones), by project (lowest task on-time rate
first) and by person (tasks they own; milestones have no single owner).

### 13.2 Workload and capacity

| Measure | Formula |
|---|---|
| Available | For each day of the period: the person's working minutes per day × capacity % on their working days (weekends and studio holidays excluded), less approved leave (a half day removes half). Pending leave is not subtracted. |
| Planned | Each scheduled task (owner and due date set, not cancelled, not archived, not a draft): its estimate — 120 minutes when it has none, and counted as "without an estimate" — spread evenly over the owner's working days from its planned start (or its due date) to its due date; with no working day in that window it lands on the due date. Only the part inside the period counts. |
| Tentative | The same for draft tasks, shown apart. |
| Logged | Ended work sessions of the person that started in the period, counted on the day they started (studio timezone). Shown only as recorded; zero when time tracking is off. |
| Planned ÷ available | Planned ÷ available, to 0.1 %; "–" with no available time. |
| Load | The capacity scale: has room below 40 %, balanced to 85 %, stretched to 105 %, overloaded above (`loadStatus`). |

People: active people in scope (studio view without project or manager filter:
everyone, or the team). With a project or manager filter, or for a project manager,
only tasks and logged time on those projects count, while available time stays each
person's whole availability. Teams are the sum of their people; periods the sum of
everyone's days. Note: this report measures the plan; the Capacity screen measures
remaining effort from today.

### 13.3 Leave taken

| Measure | Formula |
|---|---|
| Leave days | For each approved request (urgent absences included), its working days on the person's calendar (as when it was requested) that fall inside the period; a half day counts 0.5. |
| Days taken / booked ahead | Leave days up to today / after today. |
| Requests | Approved requests with at least one leave day in the period. |

Grouped by person and leave type. Reasons never appear in reports. Pending,
rejected and cancelled requests are not leave taken.

### 13.4 Approvals turnaround

| Kind | Requested | Decided | Decider |
|---|---|---|---|
| Deliverable review | the version's submission | its review (approved, changes requested or rejected) | the reviewer |
| Leave decision | the request was created | the final approval or rejection | whoever made the final decision |
| Scope change | the proposal was created | approval or rejection | the decider |

Turnaround = decided − requested, in elapsed clock hours (nights and weekends
included), to 0.1 h. For decisions made in the period: count, **median** (the middle
value; the mean of the two middle values for an even count) and **slowest** (the
longest; ties go to the earlier request). **Waiting now** counts what is undecided
today, whenever it was requested, with the age of the oldest. Urgent absences
(recorded, not requested), cancelled leave and withdrawn scope changes are not
decisions. Deliverable reviews and scope changes follow the project scope; leave
decisions follow the same people as the leave report. Broken down by decider, with
the slowest decisions linked to their records.

### 13.5 CSV export

`GET /v1/reports/:report/csv` (`delivery`, `workload`, `leave`, `approvals`,
`estimates`, `rework`, `delays`) takes the
same filters and rules as the JSON report and answers UTF-8 with a byte-order mark,
CRLF line endings, `Content-Disposition: attachment` with a dated file name
(`lintel-delivery-reliability-2026-07-24-to-2026-10-21.csv`) and `no-store`. Text
cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return are prefixed
with a single quote so spreadsheets show them as text; cells with commas, quotes or
line breaks are quoted (RFC 4180). Hours are decimal hours, rates percentages,
instants `YYYY-MM-DD HH:mm` in the studio timezone.

### 13.6 Estimate accuracy

| Measure | Formula |
|---|---|
| Counted | Done tasks (not archived) whose completion day falls in the period, on the scoped projects; with a team filter, only tasks owned by team members. |
| Logged | The task's ended work sessions — everyone's, whenever they ran — summed and rounded to whole minutes. |
| Measured | A task with an estimate above zero and logged time above zero. Only measured tasks enter the ratios. |
| Not measured / without an estimate | Estimated but no time logged / no estimate (or zero). Counted and shown apart; never in a ratio. |
| Logged ÷ estimated | Logged minutes ÷ estimated minutes, both summed over measured tasks, to 0.1 %; "–" when nothing was measured. |
| Within estimate | Measured tasks whose own logged ÷ estimated is 80 %–120 %, both ends included, ÷ measured, to 0.1 %. **Over**: above 120 %. **Under**: below 80 %. |
| Median task | The median of each measured task's logged ÷ estimated (the mean of the two middle values for an even count), to 0.1 %. |

Grouped by person (the task owner), by task type (the task's template key within its
project's template, named by the template version's task title, else the most common
task title; tasks without a template key are one group, "Added by hand"), by template
(the project's workflow template, or "No template") and by period (completion day).
The report carries `workTrackingEnabled`, so an empty report can say that time
tracking is switched off.

### 13.7 Rework rate

| Measure | Formula |
|---|---|
| Reviewed | Deliverable versions with a decision other than pending (approved, changes requested, rejected) reviewed in the period, on the scoped projects; with a team filter, only versions submitted by team members. |
| Sent back | Changes requested + rejected. |
| Rework rate | Sent back ÷ reviewed, to 0.1 %; "–" when nothing was reviewed. |

Each version counts once, on the day it was reviewed; versions still waiting are not
counted. Grouped by project, by person (who submitted the version), by period and by
task (a deliverable without a task is its own row). The ten sent back most (ties: the
most reviewed) are listed, each linked to its task or deliverable.

### 13.8 Recurring approval delays

| Kind | Wait starts | Wait ends | Counted when |
|---|---|---|---|
| Client sign-off | the latest completion of the milestone's done tasks; without one, 00:00 on its due date | the milestone is completed (sign-off recorded) | a milestone that requires client approval is completed in the period |
| Client wait | a task blocker with category client is raised | it is resolved | it is resolved in the period |
| Internal review | a deliverable version is submitted | it is reviewed | it is reviewed in the period |

Wait = end − start in elapsed clock hours (nights and weekends included), to 0.1 h,
never below zero. **Delayed** = a wait longer than 48 hours (exactly 48 is not).
Per kind and group: count, delayed, median (as in 13.4) and slowest. **Waiting now**
counts what has not ended today, whenever it began, with the age of the oldest:
sign-offs that are ready but not recorded (milestone pending, requires client approval,
every task that is not archived done or cancelled, ready by now), open client blockers
on tasks that are neither done nor cancelled, and the current version of deliverables in
review. Grouped by client (`client_name` trimmed and compared without case, shown with
the spelling of the oldest project) and by project, most delayed first (then most
waiting, then slowest). **Recurring** = a client or project with 3 or more delayed
approvals in the period. The eight longest waits that ended in the period are listed,
linked to the project timeline, the task or the deliverable. Archived tasks and
cancelled milestones never count.

## 14. Profitability (FR-FIN)

Off by default; the organisation setting **Profitability** switches it on. Budgets
and costs are visible only to people who can see a project's budget:
`projects.manage_any` (owner and administrators by default), or the project's own
manager or owner. Everyone else gets 404, and when profitability is off the
profitability endpoint answers 404 and nothing appears in the apps.

- **Cost ledger:** entries with a date (not after today), a category (consultants,
  materials, site work, other), an amount in minor units of the studio currency and
  an optional note. Entries are never edited or deleted: a mistake is voided with a
  reason (optimistic version check), stays on the ledger struck through, and stops
  counting. Recording and voiding write an audit entry; nothing goes to the project
  activity feed (which every member can read).
- **Recorded cost** = the sum of entries that are not voided.
- **Remaining budget** = budget − recorded cost (negative when over budget).
- **Margin** = (budget − recorded cost) ÷ budget, to 0.1 %.
- **Margin indicator** (`assessProfitability` in `packages/domain`): *over budget*
  when recorded cost exceeds the budget; *thin* when less than 15 % of the budget is
  left; *healthy* otherwise; *no budget set* without a budget.
- **Command center:** budget, recorded cost and remaining budget over the projects
  in view whose budgets the person may see (totals count only projects with a
  budget), with each project's bar and indicator, most attention first.

## 15. Risk intelligence: explain and drive the next action (FR-RSK)

Lintel does not only report problems: it says what is happening, what it does to the
dates, what to do next, who does it and when it escalates if nobody does. Every rule
below is plain code in `packages/domain/src/insights/` (unit-tested), works on live
records, and is applied by the read models in `packages/database/src/queries/insights/`.
`GET /v1/dashboard/briefing` (same access and filters as the command center) and
`GET /v1/projects/:id/risks` (404 when the project is hidden) serve them.

### 15.1 Business health score (formula `health-v1`)

**Score = 100 − five penalties**, rounded to a whole number and kept between 0 and 100.
Each penalty grows in a straight line with what it measures, up to its weight:

| Part | Measure (live records, in the view's scope) | Weight | Full weight at |
|---|---|---|---|
| Delivery risk | (off-track projects + ½ × at-risk projects) ÷ active projects (project health, §6) | 30 | 50 % |
| Overdue work | open tasks past their due date ÷ open tasks | 25 | 20 % |
| Blocked work | open tasks blocked (status or an open blocker) ÷ open tasks | 15 | 10 % |
| Decisions waiting | task reviews and deliverable versions in review, proposed scope changes, open handover and new-date requests on scoped projects, and pending leave of people in scope, waiting **more than 48 hours** | 15 | 5 decisions |
| Capacity strain | people above 105 % of their available time for the rest of this week (§7) ÷ people in view | 15 | 25 % |

Example: 10 active projects with 1 off track and 2 at risk (0.2 → −12), 6 of 60 open
tasks overdue (0.1 → −12.5), 3 blocked (0.05 → −7.5), 2 stale decisions (−6), 1 of 8
people overloaded (0.125 → −7.5): 100 − 45.5 = **55**. With nothing to measure (no
projects, tasks or people) a part takes nothing.

- **Bands** (status colour + glyph + word): 80–100 *Healthy*, 60–79 *Watch*, 40–59
  *At risk*, 0–39 *Critical*.
- **Biggest contributors**: the three parts taking the most points (ties keep the table's
  order), each with the sentence behind it and a link to the record that explains it best:
  the most urgent project needing attention, the most overdue task, the oldest open blocker,
  the approvals queue, or Capacity.
- **Trend**: the worker's daily run (08:30, `dailyOperationsWorkflow`) records one reading
  per scope and day in `business_health_snapshots` (the studio, and each project manager's
  live projects); a rerun the same day replaces it. The command center shows the readings of
  the last 56 days plus today's live score, and the change against the reading a week ago
  (or the earliest one since). A project or team filter has no recorded trend; the live
  score still follows every filter. The date range does not change the score: it measures now.

### 15.2 Schedule forecast and risk cards

**Forecast** (`forecastSchedule`, working days on the studio calendar): a task's duration
is the working days from its planned start to its due date (one day without a start).
Started work finishes on its due date, or today at the earliest when it is overdue; blocked
work cannot finish today (the next working day at the earliest). Work not started starts on
its planned start, but never before today and never before the working day after each open
prerequisite's forecast finish, and keeps its duration. Done and cancelled tasks never delay
anything. A commitment's forecast is the latest forecast finish of its open tasks; its
**slip** is the working days from its due date to that forecast.

**Which commitments get a card**: every pending milestone that is at risk or missed (§6: a
forecast past its date makes it at risk), and the planned delivery date when the forecast
passes it or the project is at risk or off track. Cards with the same cause (the same rule on the same
task) are merged: the earliest commitment keeps the card and lists the others it **also
delays** with their slip.

**The task that explains it**: when the commitment slips, the task where the delay starts,
followed upstream through prerequisites. Otherwise the linked open task with the most
pressing problem, in this order: blocked, overdue, a new date waiting for a decision, a late
start, the owner away, a review waiting (earliest due date first).

**Rules** (first match wins for that task):

| Rule | When | Next action | Responsible | Escalation if nobody acts |
|---|---|---|---|---|
| New date asked | an open new-date request | Accept or decline the new date | project manager | none (it waits in their approvals) |
| Blocked | blocked status or an open blocker | chase the client / supplier, make the decision, get the information, unblock the work, or clear the blocker (by category) | the person it waits on; else the manager for a manager decision; else the task owner | the blocker follow-up: project manager 1 working day after it was raised, studio owner after 3 |
| Review waiting | in review | Review the task | reviewer (else project manager) | review follow-up: reviewer after 1 working day, project manager after 3 |
| Owner away | approved leave of the owner between today and the due date | Choose who covers (links to the leave request, §15.5) | project manager | none |
| Overdue | due date before today | Finish it or ask for a new date | task owner | the deadline timeline: project manager after N working days overdue, studio owner 2 working days later for urgent work or critical projects |
| Late start | Ready or Draft, planned start before today | Start, report a blocker or ask for a new date | task owner | the same deadline timeline |
| Planned too late | due after the commitment, nothing else wrong | Re-plan the task or move the commitment | project manager | the deadline timeline, when it reaches the owner |
| Not closed | missed milestone with no open work | Mark it complete or agree a new date | project manager | none |

"When it escalates" is the next alert in that timeline addressed to someone above the
responsible person ("The studio owner is alerted on Thursday 22 October at 09:30 if it is
still blocked."). When every alert has gone, the last one is shown as already sent. The
timelines are the same functions the worker sleeps on, so the card and the alert agree.

**Severity**: *Slipping* (critical, forecast late), *Critical* (missed, or an off-track
project without a slip yet) or *At risk*. Order: critical first, larger slip, earlier date.
The command center shows the six most pressing cards in view; the project control room shows
all of the project's cards.

### 15.3 Command center additions

- **Deadlines in the next 7 days**: open, non-archived tasks due from tomorrow to a week from
  today (today has its own count), soonest first (10 listed, the count is complete), plus the
  number of pending milestones due in the same days.
- **Performance highlights**: milestones completed on or before their due date in the period,
  credited to everyone who owned one of their finished tasks (its own tasks, their subtasks and
  the unlinked work they wait for, such as the site measurement before the survey review) or
  submitted one of their deliverables; most milestones first, then the
  most recent. Every milestone counts as important (each is a client-facing commitment).
- **Owner intervention needed**: what the timelines have already escalated to the studio owner
  and is still unresolved, oldest escalation first: overdue urgent work or work on critical
  projects past the owner alert (§11), and blockers open for three working days.

### 15.4 Late-start nudge and new-date requests

- **Late-start nudge** (a step of the deadline workflow): on the working day after a task's
  planned start, at the studio reminder time, the owner of a task that is still Ready is
  asked to start it, report a blocker or ask for a new date (in-app and push through the
  Notifier, so quiet hours apply; kind `task_late_start`, linking to the task with the three
  actions). No nudge for drafts, work already started, a task without an owner or planned
  start, while a prerequisite is open (the delay belongs to that task), or when the nudge
  would come after the due date (the overdue alert covers it). The step is keyed by the
  planned start, so a new start re-plans it, and it is checked again right before sending.
- **New-date request** (`task_date_change_requests`): the owner or a collaborator asks for a
  new due date (and optionally a new start) with a reason, for open work not in review. One
  open request per task (partial unique index); the deciders are the same as for handover
  requests (the project manager; the project owner when the manager asks; studio-wide
  managers when nobody on the project can), and nobody decides their own (database CHECK).
  Accepting moves the task's dates (the start is kept unless it would fall after the new due
  date), writes `task_schedule_changes` with the reason and the request, re-plans the
  reminders through the outbox, and leaves later tasks and the baseline due date as they were
  (a scope change moves them). Declining needs a note. Every step writes activity and audit;
  the person who asked (and the owner, when someone else asked) is told. Requests appear in
  the approvals queue (urgent when the task is due by today or the request is three or more
  days old, like other approvals) and on the task.

### 15.5 Cover suggestions for absences (strategy `cover-v1`)

For a leave request waiting for a decision or approved, and for an urgent absence, each
affected task (§8 conflicts) on a project the viewer manages gets up to three suggestions.
Only people who fit are considered: the same role on the task's project as the absent owner,
a member of that project, or the same designation (case-insensitive; Lintel has no skills
list in Phase 1, so the designation stands for it). Left out: the absent person, the task's
reviewer, anyone with leave (approved or pending) in the cover days, and anyone not working
then.

- **Cover days**: from the later of the leave's start, today and the task's planned start,
  to the earlier of the leave's end and the due date (overdue work: the first day away).
- **Need**: the task's remaining effort (estimate − logged, 120 minutes without an estimate)
  spread over the owner's working days to its due date, counted on the cover days.
- **Free time**: available minus confirmed and blocked work on those days (§7).
- **Points**: same project role 40 (or member of the project 20), same designation 25, room
  up to 30 (free ÷ need, capped at 1). People with any free time come first, then points, then
  free time. Each suggestion lists its reasons ("Designer on this project · 8 h free in those
  days").

Nothing is reassigned by a suggestion. Choosing one opens the existing flow with the person
picked: the leave handover when one is proposed for the task (a project manager hands it
over), otherwise the task's Change owner sheet (`POST /v1/tasks/:id/assign`, audited).
`GET /v1/leave/requests/:id/cover-suggestions` answers 404 to people who cannot see the
request and lists no tasks to people who manage none of them.

## 16. First-run tips (FR-TIP)

- The first time someone opens Today, a task, a project's control room, leave or the
  command center, a short tip for their role appears in the page (never a modal, never
  blocking). Audience follows capabilities: owner (`dashboard.view_business`), manager
  (`projects.create`, `tasks.assign` or `leave.approve_team`), otherwise member; the
  command center tip is for managers and owners only. The words live in the domain
  (`guidance-tips.ts`).
- A tip is marked seen on the server as soon as it shows (`POST /v1/me/guidance/:tip/seen`),
  so it appears once across devices; it stays for that visit until dismissed. Account →
  Tips shows how many were seen and "Show tips again" (`POST /v1/me/guidance/reset`).

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
