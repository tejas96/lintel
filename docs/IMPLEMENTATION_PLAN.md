# Implementation Plan and Progress

Legend: ✅ done and verified · 🟡 built, partly verified · 🔄 in progress · ⏳ not started · ⛔ blocked (needs something external)

Last updated: 2026-10-21 (overnight build session).

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
- ✅ ts-rest contracts for every module (≈95 routes) + OpenAPI at `/docs`; contract tests.
- ✅ OTP sign-in (hashed codes, limits, enumeration-safe), sessions (cookie + CSRF, bearer), sign-out, session list/revoke — 6 unit tests + live curl verification.
- ✅ MSG91 adapter (unit-tested against documented contract) + local development provider.
- ✅ Initial migration (44 tables) and idempotent seed.
- ⛔ Live MSG91 delivery — needs an auth key and DLT template.

## Stage 3 — Core project and task operations 🔄

- ✅ Domain: workflow templates, presets for 5 project types, plan builder, validator, task state machine with explained guards, dependency graph, project health, milestone risk.
- ✅ People directory and administration (API verified).
- 🔄 Projects, templates, milestones, scope changes, settings, audit (builder A).
- 🔄 Tasks, work queue, work sessions, blockers, deliverables, files, site updates (builder B).

## Stage 4 — Web experiences 🔄

- ✅ Design tokens (light/dark, status, type, motion).
- 🔄 Design system components, app shell, sign-in, Today, task detail, projects, control room (web builder).
- ⏳ Command center, capacity, leave, approvals, rewards, templates editor, settings UI.

## Stage 5 — Leave, notifications, rewards, Temporal 🔄

- ✅ Domain: leave periods/conflicts/policy, capacity calculator, reward criteria/metrics/eligibility, notification policy, deadline escalation plan.
- ✅ Notifier (dedupe, quiet hours, outbox event).
- 🔄 Leave, capacity, rewards, notifications, devices, command center, approvals queue (builder C).
- 🔄 Worker: outbox relay + deadline, review, blocker, leave, notification-delivery workflows + daily schedule (builder D).

## Stage 6 — Mobile 🔄

- 🔄 Expo SDK 58 app: sign-in, Today, task detail, projects, leave, approvals, site updates, notifications, account, push registration (mobile builder).

## Stage 7 — Hardening ⏳

- ⏳ Production Dockerfile + compose + Caddy; backup script.
- ⏳ CI pipeline running `pnpm check`.
- ⏳ End-to-end journey tests (owner creates project → … → reward review).
- ⏳ Security review against `SECURITY.md` checklist; dependency audit.

## Stage 8 — Phase 2 preparation ✅

- ✅ AI disabled by configuration (refuses `true`), `DisabledAiAssistant` port + test, `/v1/ai/status`.
- ✅ `AI_PHASE_TWO.md`: capabilities, boundary, activation, audit.

## Known external blockers

| Item | Needs |
|---|---|
| Real SMS OTP | MSG91 auth key, DLT-registered template, server IP allow-list |
| Real push | Firebase project + service account; Apple Developer account + APNs key; Firebase iOS SDK in the app |
| iOS/Android store builds | Apple Developer Program, Google Play Console, signing keys |
| Production host | Oracle Cloud access, DNS, TLS email |
