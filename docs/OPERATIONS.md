# Operations

## Local development

Prerequisites: Node 22.12+ (22.22 tested), pnpm 10.34.5, Docker with Compose v2.

```bash
pnpm install
cp .env.example .env
pnpm infra:up                         # PostgreSQL 17, RustFS, Temporal dev server
pnpm build
DATABASE_URL=postgres://lintel:lintel-local-only@127.0.0.1:5450/lintel pnpm db:migrate
DATABASE_URL=postgres://lintel:lintel-local-only@127.0.0.1:5450/lintel pnpm db:seed
pnpm dev                              # API :4100, web :3100, worker, package watchers
```

| Service | URL |
|---|---|
| Web app | http://localhost:3100 |
| API + OpenAPI docs | http://localhost:4100/v1/health · http://localhost:4100/docs |
| Temporal UI | http://localhost:8240 |
| RustFS console | http://localhost:9111 |
| PostgreSQL | `127.0.0.1:5450` (user `lintel`) |

Sign in with `+91 90000 00001` (owner) … `00010`; the code is `123456` while
`OTP_DEVELOPMENT_CODE=123456` (development only).

### Docker images used (reused from the machine, nothing pulled)

`postgres:17-alpine`, `rustfs/rustfs:1.0.0`, `temporalio/admin-tools:1.30.6`
(its Temporal CLI runs the dev server). Production additionally uses
`temporalio/server:1.30.6` (also present locally), `caddy:2-alpine`, and a
`node:22-bookworm-slim` base for the app images (glibc is required by Temporal's
native worker). Containers log through the `json-file` driver with rotation
(10 MB × 3). Volumes: `lintel-pgdata`, `lintel-objects`, `lintel-temporal`.
Other projects' containers and volumes on the machine are never touched.

### Browser end-to-end and accessibility tests

```bash
pnpm infra:up && pnpm build        # the suite runs the built API and web app
pnpm test:e2e                      # Playwright + axe, ~1 minute after the first web build
```

- Ports 4131 (API) and 3131 (web); database `E2E_DATABASE_URL` (default
  `…/lintel_channels_e2e` locally, `…/lintel_e2e` in CI). The API's start command resets
  that database (its name must contain `e2e`), migrates and seeds it, so each run starts
  from the same demo studio. Object storage uses the local RustFS with bucket `lintel-e2e`.
- The web build bakes the `/api` rewrite in: the suite rebuilds `apps/web` when it does
  not point at port 4131 (set `E2E_REBUILD_WEB=1` after changing web code locally). Stop
  any `next start` serving the same `apps/web/.next` first.
- Browsers: CI runs `playwright install --with-deps chromium`. Locally the Chromium build
  of the pinned Playwright (1234) is used when cached, or Google Chrome with
  `E2E_BROWSER_CHANNEL=chrome`; the suite never downloads a browser itself.
- Reports: `apps/e2e/playwright-report` (traces and screenshots on failure; minor axe
  findings are attached to each test). Serious or critical axe violations fail the run.

## Notification channels (SMS, email, web push)

| Variable | Default | Notes |
|---|---|---|
| `SMS_NOTIFICATIONS_ENABLED` | `false` | Plans SMS for urgent kinds people opted into |
| `SMS_PROVIDER` | `log` | `msg91` sends; `log` records in the worker log (refused in production when SMS is on) |
| `MSG91_SMS_TEMPLATE_ID` / `MSG91_SMS_DLT_TEMPLATE_ID` | — | Required with `SMS_PROVIDER=msg91` (see INTEGRATIONS.md) |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | Plans email per kind and the daily digest |
| `EMAIL_PROVIDER` | `log` | `smtp` sends; `log` writes to the worker log (refused in production when email is on) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TIMEOUT_MS` | 587, TLS required | Production refuses SMTP without TLS |
| `EMAIL_DIGEST_TIME` | `18:00` | Daily digest, studio timezone (`lintel-email-digest` Schedule, suffixed per task queue like the others) |
| `NEXT_PUBLIC_FIREBASE_*` (5) | — | Web build only; web push hides itself without them |

Production also refuses SMS or email when `WEB_BASE_URL` is not `https://` (messages
carry links). After changing `EMAIL_DIGEST_TIME`, restart the worker: it updates the
Schedule in place.

## Production deployment (single host, e.g. Oracle Cloud Mumbai)

Target: 4 OCPU, ~22 GB RAM. Inspect the real disks first (`lsblk`, `df -h`) — the
stated "200 GB" and "20 GB" may be a boot volume and a block volume; put Docker's
data root and the PostgreSQL/RustFS volumes on the larger block volume.

Estimated steady-state memory: PostgreSQL 1–2 GB, Temporal server 0.5–1 GB, RustFS
0.3–0.5 GB, API 0.3 GB, worker 0.3 GB, web 0.3 GB, Caddy < 0.1 GB → ~4–5 GB,
leaving headroom for the OS cache and builds.

Files:

- `infrastructure/docker/Dockerfile` — multi-stage build with targets `api`, `worker`, `web`, `migrate`.
- `infrastructure/docker/compose.production.yaml` — PostgreSQL, Temporal (PostgreSQL
  persistence) + schema job + namespace job, RustFS, migrate job, API, worker, web,
  Caddy (TLS, same-site routing: `/api/*` → API, everything else → web).
- `infrastructure/docker/Caddyfile`.

Steps:

1. Provision DNS (`studio.example.com`) → the instance; open 80/443 only.
2. Create `/opt/lintel/.env` from `.env.example` with production values
   (see the checklist in `SECURITY.md`). `NODE_ENV=production`.
3. `docker compose -f infrastructure/docker/compose.production.yaml --env-file /opt/lintel/.env up -d --build`
4. The `migrate` job applies migrations before the API and worker start.
5. Set up the studio once, with the migrate image (it holds the setup command):

   ```bash
   docker compose -f infrastructure/docker/compose.production.yaml --env-file /opt/lintel/.env \
     run --rm migrate node dist/setup/setup-studio.cli.js \
     --studio-name "Aranya Design Studio" --owner-name "Aarav Mehta" \
     --owner-phone "+91 98765 43210" --timezone Asia/Kolkata --currency INR
   ```

   In one transaction it creates the organisation settings, the studio week
   (Monday to Saturday, 09:30 to 18:30, 8 hours of work), the default role access
   and the owner account. It creates no demo data: no people, teams, leave types,
   holidays, templates or projects. Optional: `--owner-email`,
   `--owner-country-code` (default 91), `--reference-prefix` (default: the studio
   name's initials). Every option can also be passed as an environment variable
   (`-e LINTEL_STUDIO_NAME=…`, `LINTEL_OWNER_NAME`, `LINTEL_OWNER_PHONE`,
   `LINTEL_OWNER_EMAIL`, `LINTEL_OWNER_COUNTRY_CODE`, `LINTEL_TIMEZONE`,
   `LINTEL_CURRENCY`, `LINTEL_REFERENCE_PREFIX`). `--help` prints the options.
   The phone number is normalised exactly as at sign-in.

   It is safe to run again: once settings, an owner or a default calendar exist it
   refuses and changes nothing. Exit codes: `0` set up, `1` invalid input or a
   failure, `2` already set up. It prints the next steps: sign in as the owner,
   check Settings (Studio, Holidays, Working week), add leave types under
   Settings, Leave, add people under People, and start templates from Lintel's
   starting point. Locally the same command is
   `pnpm --filter @lintel/database setup:studio -- --studio-name … ` (after
   `pnpm build`, with `DATABASE_URL` set); it runs with `NODE_ENV=production`.
6. Verify: `/api/v1/health/ready` reports `ready`; sign in; Temporal UI (bind to
   localhost and reach it through an SSH tunnel only).

**One Temporal namespace per environment.** Schedule IDs are unique per namespace.
The worker on the main task queue (`lintel-main`) owns `lintel-daily-operations` and
`lintel-periodic-rewards`; workers on any other queue (developers, previews sharing a
namespace) create suffixed copies (`…--<task-queue>`) instead of re-pointing the main ones.

**Verified 2026-10-21:** all four images built from `infrastructure/docker/Dockerfile`
(api 589 MB, worker 848 MB, web 424 MB, migrate 393 MB); the migrate image applied
migrations to a fresh database; the API image refused to start in production mode
with development secrets and reported ready (database, storage, Temporal) in
development mode; the worker image connected and registered its schedules; the web
image served pages and proxied `/api` to the API container. Not yet verified: the
full `compose.production.yaml` with Temporal on PostgreSQL and Caddy TLS.

Updates: pull the new revision, `docker compose … up -d --build`; migrations run
first; API and worker restart with graceful shutdown (Temporal workers drain).

## Backups and recovery

| What | How | Frequency |
|---|---|---|
| PostgreSQL (business data + Temporal) | `infrastructure/scripts/backup-postgres.sh` → `pg_dump -Fc` per database, gzip, keep 14 daily + 8 weekly, copy off-host (Object Storage bucket) | daily |
| RustFS objects | snapshot the block volume, or mirror the bucket with any S3 client to off-host storage | daily |
| Configuration | `/opt/lintel/.env` in a secrets manager / password vault | on change |

Restore drill (do it before go-live and quarterly): create a fresh database,
`pg_restore` the latest dump, start the stack against it, sign in, open a project
and download a file. Temporal state can be lost without losing business data: the
worker's daily job re-creates missing deadline workflows from the database.

## Monitoring

- Health: `GET /api/v1/health` (liveness), `/api/v1/health/ready` (database, storage, Temporal).
- Logs: JSON lines with request IDs; secrets redacted. Ship with the host's log agent if desired.
- Temporal UI: failed workflows and activities with retry history.
- Outbox backlog: `select count(*) from outbox_events where processed_at is null;`
  should stay near zero; rows with high `attempts` carry `last_error`.
- Notification delivery: `notification_deliveries` grouped by `channel` and `status`;
  every SMS/email attempt is in `notification_delivery_attempts` (`outcome` null means
  the attempt was interrupted, `error` is safe text); digests in `email_digests`
  (one row per person and day). Emails waiting for a digest have status `digest`.

## Troubleshooting

| Symptom | Check |
|---|---|
| Sign-in code never arrives | `OTP_PROVIDER`, MSG91 key/template, IP allow-list; the API log shows a safe reason |
| Readiness "degraded" | which check is false; container health; credentials |
| Reminders not sent | worker running? outbox backlog? Temporal UI for failed activities |
| Push "skipped" | `PUSH_PROVIDER=log` or iOS APNs token without Firebase iOS SDK (see `INTEGRATIONS.md`) |
| SMS or email "skipped" | Development sender (`SMS_PROVIDER`/`EMAIL_PROVIDER=log`), or the person has no email address / is inactive; the attempt row says which |
| No daily digest | Nothing was held for that person (empty digests are never sent), or the `lintel-email-digest` Schedule is paused (Temporal UI) |
| No "this browser" card on Account | `NEXT_PUBLIC_FIREBASE_*` were not set when the web app was built |
| 409 STALE_VERSION | someone else changed the record; refresh and retry (by design) |
