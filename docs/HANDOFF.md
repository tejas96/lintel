# Morning handoff — 21 October 2026

## What you have

**Lintel**, a business operations platform for interior design and architecture studios:

- **API** (NestJS) — 103 contract routes plus a file-download route; everything except
  sign-in and health checks needs a session and passes permission checks.
- **Background worker** (Temporal) — deadline reminders, escalations, review and blocker
  follow-ups, leave reassessment, push delivery, a daily 08:30 check, monthly reward runs.
- **Web app** (Next.js) — every Phase 1 screen, light and dark, calm-motion option
  (50 screenshots in `docs/screenshots/web/`).
- **Mobile app** (Expo, iOS + Android) — runs on the iOS simulator and the Android emulator
  (31 screenshots in `docs/screenshots/mobile/`).
- **Docs** — `docs/` (start with `README.md` and `docs/IMPLEMENTATION_PLAN.md`).

All code is committed on `main` (local git, nothing pushed anywhere).

## Running right now

| What | Where |
|---|---|
| Web app | http://localhost:3100 |
| API + docs | http://localhost:4100/docs |
| Temporal UI | http://localhost:8240 |
| Database / files / Temporal | Docker: `lintel-postgres`, `lintel-object-store`, `lintel-temporal` |

Sign in with **+91 90000 00001** (owner). The code is **123456** (development only).
Other people: `…02` admin, `…03` / `…04` project managers, `…05` team lead,
`…06`–`…09` designers/architect, `…10` site supervisor. All people, clients and
projects are fictional demo data.

To start everything again later:

```bash
pnpm infra:up
cd apps/api && node --env-file=../../.env dist/main.js
cd apps/worker && node --env-file=../../.env dist/main.js
cd apps/web && PORT=3100 pnpm start
```

## What was verified

- Quality gates: Biome lint (0 errors, 0 warnings), every file ≤ 250 lines, package
  boundaries, strict typecheck, 267 unit tests, 11 API integration tests (including two
  full business journeys), 6 database and 15 Temporal integration tests.
- Live checks of every API route per role; web screens in a real browser at desktop and
  phone sizes; mobile app on the iOS simulator and Android emulator; production Docker
  images built and started.
- An independent security review: no critical or high issues; all confirmed findings fixed
  and re-tested (details in `docs/SECURITY.md`).

## Decisions I made for you (all reversible)

- **Name:** "Lintel" (the beam above a doorway). Demo studio: "Aranya Design Studio".
- **Versions:** NestJS 11 (not 12), Zod 3 and TypeScript 5.9, because the required
  ts-rest library supports only those. Reasons in `docs/DECISIONS/0002` and `0009`.
- **One studio per installation** (not multi-company).
- **Sign-in codes** are generated and checked by Lintel; MSG91 only delivers the SMS.
- **Leave types and allowances, reward amounts and holidays** in the demo are examples,
  not legal entitlements — please set your own in Settings.
- **Docker:** reused your local images. I pulled one image, `node:22.22.3-bookworm-slim`,
  to build the production images, and kept it (the Dockerfile uses it). The test images I
  built were removed. Your other projects' containers and volumes were not touched.

## What needs you

| To switch on | You need |
|---|---|
| Real SMS sign-in codes | MSG91 account: auth key, a DLT-approved OTP template, the server IP allow-listed |
| Push notifications | Firebase project + service account; for iPhone also an Apple Developer account, an APNs key, and the Firebase iOS SDK added to the app (`apps/mobile/README.md`) |
| App Store / Play Store | Apple Developer Program, Google Play Console, signing keys |
| Production server | Oracle Cloud access, a domain name, then follow `docs/OPERATIONS.md` |

## Suggested next steps

1. Look through the web app as owner, a designer (`…06`) and the site supervisor (`…10`).
2. Replace the demo data with your real team (People → Add person) and your workflow
   templates (Templates).
3. Decide on the open security items listed under "Known residual risks" in `docs/SECURITY.md`.
4. Small product gaps: people cannot edit their own profile yet; offline mode is not built
   (the apps are online-first); iOS push needs the Firebase iOS SDK.
