# Implementation Plan and Progress

Legend: ✅ done and verified · 🟡 built, partly verified · 🔄 in progress · ⏳ not started · ⛔ blocked (needs something external)

Last updated: 2026-10-21, end of the overnight build session.

## Stage 0 — Assessment ✅

- ✅ Empty repository confirmed; git initialised on `main`.
- ✅ Machine: 15 CPU, 24 GB RAM, 160 GB free on the work volume; Docker 29.5, Compose v5.1.
- ✅ Local images reused: `postgres:17-alpine`, `rustfs/rustfs:1.0.0`, `temporalio/admin-tools:1.30.6` (no pulls).
- ✅ Versions researched and pinned (`INTEGRATIONS.md`); integration facts with sources (`research/`).
- ✅ Design research: 5 references + original visual direction (`DESIGN_REFERENCES.md`).

## Stage 1 — Monorepo foundation ✅

- ✅ pnpm workspace + catalog, Turborepo, Biome, strict TypeScript bases.
- ✅ Docker Compose (PostgreSQL 17 :5450, RustFS :9110/:9111, Temporal dev :7240/:8240) — all healthy.
- ✅ Environment validation with production refusals (`packages/configuration`, 4 tests).
- ✅ File-size (≤250 lines) and dependency-boundary checks.
- ✅ Health endpoints (`/v1/health`, `/v1/health/ready`).
- ⏳ CI workflow file (GitHub Actions) — see Stage 7.

**Acceptance:** builds and infrastructure start without production credentials — met.

## Stage 2 — Identity and contracts ✅

- ✅ Domain: roles, capabilities, access rules.
- ✅ ts-rest contracts for every module (103 routes) + OpenAPI at `/docs`; contract tests.
- ✅ OTP sign-in (hashed codes, limits, enumeration-safe), sessions (cookie + CSRF, bearer), sign-out, session list/revoke — 6 unit tests + live curl verification.
- ✅ MSG91 adapter (unit-tested against documented contract) + local development provider.
- ✅ Initial migration (44 tables) and idempotent seed.
- ⛔ Live MSG91 delivery — needs an auth key and DLT template.

## Stage 3 — Core project and task operations ✅

- ✅ Domain: workflow templates, presets for 5 project types, plan builder, validator, task state machine with explained guards, dependency graph, project health, milestone risk.
- ✅ People directory and administration (API verified).
- ✅ Projects (create from template, detail, members, status, milestones, activity), templates (draft/publish versions), scope changes (preview/propose/decide with schedule history), settings, roles, holidays, audit — 31 unit tests, 108 live API checks; migration 0001.
- ✅ Tasks (explained transitions, assignment, dependencies with loop refusal, checklists, blockers, comments), work queue, work sessions, priority conflicts, deliverables with versions and review, file upload/download with content checks, site updates — 28 unit + 4 integration tests, ~150 live checks.
- ✅ Demo seed: 6 projects through the real use case, mixed health.

## Stage 4 — Web experiences ✅

- ✅ Design tokens (light/dark, status, type, motion) → generated theme CSS; `@lintel/design-system` web components.
- ✅ App shell (capability-gated nav, ⌘K, notifications bell), sign-in, Today, task page + drawer, projects (cards/table, 4-step wizard), project control room (overview, board, Gantt timeline, list, deliverables, scope changes, activity), people, settings (studio, roles, holidays), approvals inbox, leave (balances, requests, impact preview), owner command center — verified in a browser against live data at 1440/390 px, light/dark, calm motion; 30 screenshots in `docs/screenshots/web/`.
- ✅ Leave decision page, handover proposals, urgent absence, capacity grid (week/fortnight), rewards (my recognition, review queue, policies), workflow template editor (draft/validate/publish/history), people administration, account & notification preferences, audit log with diffs, deliverable page; uploads with inline previews, comments, work timer, scope-change propose/decide, board drag & drop — verified in a browser, screenshots 31–50.
- ✅ Re-verified on `main` in the in-app browser: sign-in, Today, command center (live counts), project control room.

## Stage 5 — Leave, notifications, rewards, Temporal ✅

- ✅ Domain: leave periods/conflicts/policy, capacity calculator, reward criteria/metrics/eligibility, notification policy, deadline escalation plan.
- ✅ Notifier (dedupe, quiet hours, outbox event).
- ✅ Leave (two-level approval, info round-trip, cancel, urgent absence, handovers), capacity, rewards (policies, idempotent evaluation, decisions, restricted amounts), notifications + preferences, devices, command center, approvals queue — 56 unit + 2 integration tests, live checks per role.
- ✅ Worker extras: daily security housekeeping; monthly/quarterly reward evaluation Schedule (`lintel-periodic-rewards`).
- ✅ Worker: outbox relay + deadline, review, blocker, leave, notification-delivery workflows + daily 08:30 schedule — 44 unit + 15 Temporal integration tests; verified on the main database (89 events relayed, reminders and escalations created).

## Stage 6 — Mobile ✅ (store release ⛔)

- ✅ Expo SDK 58 / React Native 0.88 app: sign-in (SMS autofill), Today (swipe actions), task detail (server transitions, timer, checklist, blockers, camera/photo/file uploads, deliverables, comments), projects, leave (impact preview, handovers, decisions), approvals, site log for supervisors, inbox with deep links, account (sessions, quiet hours, push permission).
- ✅ iOS development build compiled with Xcode and run on the iPhone 17 Pro simulator; Android debug build run on a Pixel 8 emulator; `expo export` for both platforms; 27 iOS + 4 Android screenshots in `docs/screenshots/mobile/`.
- ⛔ Real push delivery (needs Firebase + APNs), physical devices, release signing and store submission.

## Stage 7 — Hardening ⏳

- ✅ Production Dockerfile + compose (Temporal on PostgreSQL) + Caddy; backup script; `.dockerignore`.
- ✅ CI workflow (`.github/workflows/ci.yml`) running every quality gate.
- ✅ API end-to-end journeys: project lifecycle (template → assign → block → deliverable review loop → done → milestone → outsider 404) and people operations (leave conflicts → two-level approval → handover → capacity → inbox → idempotent rewards → restrictions).
- ✅ Idempotency-Key replay for retried commands.
- ✅ Independent security review: 0 Critical/High; 3 Medium + 13 Low/suspected fixed and re-tested live; residual risks listed in `SECURITY.md`.
- ✅ Production images built and smoke-tested (api, worker, migrate, web).
- ⏳ Dependency audit (`pnpm audit --prod`) runs in CI; not yet reviewed.
- ✅ Browser end-to-end journeys and axe accessibility checks (`apps/e2e`, `pnpm test:e2e`, 31 tests).

## Stage 8 — Phase 2 preparation ✅

- ✅ AI disabled by configuration (refuses `true`), `DisabledAiAssistant` port + test, `/v1/ai/status`.
- ✅ `AI_PHASE_TWO.md`: capabilities, boundary, activation, audit.

## Stage 9 — Gap closure (21 Oct, afternoon) ✅

A review against the original requirements found gaps; all were built, merged and verified.

- ✅ Production first-time setup command (`setup:studio`), refuses when a studio exists.
- ✅ Leave types and rules administration; working weeks (studio and per person).
- ✅ Self-profile editing (web and mobile); the work-tracking setting is enforced.
- ✅ Per-task escalation timing; an "Edit details" sheet on the task page.
- ✅ Command center filters (in the URL); reports (delivery, workload, leave, approvals) with CSV export.
- ✅ Profitability (optional): project cost ledger, budget vs cost, margin indicator.
- ✅ Project documents library (web and mobile); reassignment (handover) requests.
- ✅ Moving a project to a newer template version (preview, then apply); scope changes that add or cancel tasks.
- ✅ SMS and email notifications (with daily digest) and web push, behind ports with development adapters.
- 🟡 Live SMS, email and web push not tried: no MSG91 SMS template, SMTP server or Firebase web app yet.

## Stage 10 — Planning flexibility (21 Oct, evening) ✅

Built on branch `claude/keen-bardeen-6da0eb` (migration `0006_planning_flexibility`).

- ✅ Optional due time on tasks (studio time): Today's order and overdue flags, the deadline
  reminders (overdue at the due time) and every task screen on web and phone use it.
- ✅ Tailor a project before it starts: the wizard's Plan step leaves out or adds stages and
  tasks, changes start dates and lengths and picks a person per task, with a live plan
  preview and end date from the same plan builder that creates the project.
- ✅ Scope changes carry a cost (to the cost ledger on approval) and a fee (added to the
  budget), seen only by budget viewers, and can require the client's sign-off (who, when,
  how; every record kept) before approval.
- ✅ Drag to reschedule on the timeline (and the keyboard alternative): the knock-on is
  shown before saving; committed dates keep a reason and history; a move of the agreed
  end becomes a scope change.
- ✅ First-run tips per role on Today, a task, the project control room, leave and the
  command center, stored per person (seen once on any device); "Show tips again" in Account.

## Known external blockers

| Item | Needs |
|---|---|
| Real SMS OTP | MSG91 auth key, DLT-registered template, server IP allow-list |
| Real push | Firebase project + service account; Apple Developer account + APNs key; Firebase iOS SDK in the app |
| Web push | Firebase web app config and VAPID key (web build arguments) |
| SMS notifications | MSG91 SMS template with the generic text and its DLT template ID |
| Email notifications | SMTP server and credentials; SPF/DKIM for the sender domain |
| iOS/Android store builds | Apple Developer Program, Google Play Console, signing keys |
| Production host | Oracle Cloud access, DNS, TLS email |
