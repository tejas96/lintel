# Security

Security controls live in the code paths below; this document says where, so a
reviewer can check each one.

## Authentication

| Control | Implementation |
|---|---|
| Phone OTP, 6 digits, 5-min expiry, single use | `packages/application/src/identity/request-otp.command.ts`, `verify-otp.command.ts` |
| OTP stored only as HMAC-SHA-256 (server secret) | `HmacSecretHasher` in `packages/integrations/src/security/node-crypto.ts` |
| Constant-time comparison | `timingSafeEqual` in `HmacSecretHasher.matches` |
| Max 5 wrong attempts, then the challenge is invalidated | `VerifyOtpCommand` + `otp_challenges.attempts` |
| No account enumeration | identical response for unknown numbers; codes only sent to active accounts; one generic failure message |
| Abuse limits that survive restarts and scale out | `FixedWindowRateLimiter` over `rate_limit_counters` (per phone and per hashed IP); global per-IP throttle via `@nestjs/throttler` |
| Opaque sessions, hashed at rest, revocable | `sessions` table, `AuthenticateSessionQuery`, `SessionManagement` (sign-out, revoke one, revoke all on deactivation) |
| Web cookie flags | HttpOnly, `SameSite=Lax`, `Secure` in production, path `/` (`session-cookies.ts`) |
| CSRF | double-submit token: `lintel_csrf` cookie echoed in `x-lintel-csrf` on unsafe methods for cookie sessions (`session.guard.ts`); JSON-only bodies block cross-site form posts |
| Mobile token storage | expo-secure-store (Keychain / Android Keystore) |
| Development OTP safety | local provider and `OTP_DEVELOPMENT_CODE` refused when `NODE_ENV=production` (`assertProductionSafety` and the provider constructor) |

## Authorisation

- Global `SessionGuard`: every route requires a session unless marked `@Public()`
  (only sign-in and health checks are public).
- Capabilities (not role names) for organisation-wide actions; role→capability
  mapping stored in the database, owner always complete.
- Project-scoped records go through `ProjectAccessService` (view / manage / assign).
  Missing and forbidden records both return 404 to prevent ID probing (IDOR).
- Client-supplied user IDs, roles, ownership or project claims are never trusted;
  the actor comes from the verified session.
- Sensitive fields are filtered on the server: budgets and project costs
  (`projects.manage_any`, or the project's own manager or owner — see
  `canSeeProjectFinances`), reward amounts (the person or `rewards.view_all`),
  phone numbers always masked in directory views. Cost entries are audited and
  never written to the project activity feed, which every member can read.
- Reports: `dashboard.view_business` sees the studio; project managers only the
  projects they manage (a project filter outside them answers 404); leave in a
  manager's reports is limited to the people their leave and capacity rights
  cover; everyone else gets 403. Leave reasons never appear in reports.
- CSV exports (`/v1/reports/:report/csv`): same session and rules as the JSON
  report, `Cache-Control: private, no-store`, `nosniff`, attachment with an
  RFC 6266 file name; text cells starting with `= + - @`, tab or CR are prefixed
  with a single quote so spreadsheets never run them as formulas.
- Separation of duties: nobody reviews their own deliverable; only the owner can
  grant the owner role; the owner account cannot be deactivated.

## Data protection

- Files: type detected from content (magic bytes), allow-list (images incl. HEIC,
  PDF, DWG, Office), size limit (`UPLOAD_MAX_BYTES`), random object keys without
  user-supplied names, served only after an access check with `nosniff` and safe
  `Content-Disposition`. The bucket is private.
- Secrets only in environment variables; `.env*` (except `.env.example`), service
  account files, signing keys and keystores are git-ignored.
- Logs are structured JSON with redaction of `authorization`, cookies, CSRF header,
  OTP codes and session tokens (`logger.module.ts`); request IDs correlate logs and
  error responses.
- Error responses never include stack traces or provider messages; unexpected
  errors return a generic message plus the request ID.
- Push previews for sensitive kinds (rewards, leave decisions) are generic.
- **SMS never carries notification content:** the `SmsSender` port only accepts a phone
  number and a link; the text is one pre-approved generic template. Links are built from
  `WEB_BASE_URL` and an in-app path only (`appLink` rejects `//host`, full URLs and
  backslashes) and every opened record is re-authorised.
- **Email** carries the inbox text except for sensitive kinds, which read "You have a
  private update"; the digest applies the same rule. Every value placed in the HTML is
  escaped. `Auto-Submitted: auto-generated` stops auto-replies; Nodemailer file and URL
  access is disabled.
- Logs and attempt rows hold masked recipients (`+91 •••••• 0005`, `t•••@domain`) and
  mapped error text only — never provider bodies, full numbers or addresses.
- **Web push:** the service worker is served `no-store` with its own CSP, never controls
  application pages (Firebase's push scope), and FCM opens only same-origin https links.
  The Firebase web config is public by design; the service-account key stays server-side.
  Signing out unregisters the browser's installation and device row.

## Transport and headers

Helmet defaults (HSTS, frame-ancestors via `X-Frame-Options`, `nosniff`,
referrer policy). Strict CSP in production (Swagger UI is development-only). CORS
allow-list from `CORS_ALLOWED_ORIGINS` with credentials. `trust proxy` only when
`TRUST_PROXY=true` behind a known reverse proxy.

## Integrity and reliability

Optimistic concurrency (`version` columns) on mutable records; transactions per
command; outbox for events; dedupe keys for notifications; unique index for reward
periods; deterministic Temporal workflow IDs; idempotent activities.

## Production startup refusals (`packages/configuration`)

The API and worker refuse to start in production when: `SESSION_SECRET` is the
development default, `OTP_PROVIDER` is not `msg91`, `OTP_DEVELOPMENT_CODE` is set,
`STORAGE_SECRET_KEY` is the development default, `PUSH_PROVIDER` is `log`,
`COOKIE_SECURE=false`, provider credentials are missing, or
`AI_FEATURES_ENABLED=true`. For notification channels it also refuses: SMS switched on
with `SMS_PROVIDER` other than `msg91`; email switched on with `EMAIL_PROVIDER` other
than `smtp`; SMTP without TLS (`SMTP_SECURE` or `SMTP_REQUIRE_TLS`); SMS or email with a
non-https `WEB_BASE_URL`; `SMS_PROVIDER=msg91` without the SMS and DLT template IDs;
`EMAIL_PROVIDER=smtp` without host and sender. The development SMS and email senders
also refuse to be constructed in production.

## Pre-deployment security checklist

- [ ] Fresh `SESSION_SECRET` (≥ 48 random bytes), storage keys, database password.
- [ ] MSG91 auth key with IP allow-listing; DLT-approved template for +91 numbers.
- [ ] If SMS/email are on: the generic SMS template registered with MSG91 and DLT; SMTP
      credentials scoped to sending; SPF/DKIM/DMARC set up for the `SMTP_FROM` domain.
- [ ] Firebase service account restricted to FCM; APNs key uploaded to Firebase.
- [ ] HTTPS everywhere; API and web on the same site; `COOKIE_SECURE=true`.
- [ ] `CORS_ALLOWED_ORIGINS` lists only the production web origin.
- [ ] PostgreSQL, RustFS and Temporal reachable only on the private network.
- [ ] Backups configured and a restore tested (`OPERATIONS.md`).
- [ ] `pnpm audit --prod` reviewed; no critical advisories open.
- [ ] Owner account phone verified; administrator roles reviewed.
- [ ] Log retention and access reviewed (logs contain masked phones only).
- [ ] Penetration test of sign-in, file download and project-scoped routes.

## Security review — 2026-10-21

An independent read-only review (code reading + live reproduction against the
local API) found **no Critical or High issues**. Every project-scoped route
probed as a non-member returned 404. Findings and their status:

| Finding | Severity | Status |
|---|---|---|
| Dashboard leave list showed other people's leave reasons to project managers | Medium | **Fixed** — managers see only leave awaiting their decision; reasons never on the dashboard |
| A manager could approve their own leave by recording an "urgent absence" | Medium | **Fixed** — never for oneself; only within the person's reporting line or with `leave.approve_any` |
| Non-managers could add people to a project by assigning them work | Medium | **Fixed** — only project managers add members implicitly; reviewers and "waiting on" people must be members |
| Administrators could change another administrator's phone (sign-in credential) silently | Medium (suspected) | **Fixed** — owner-only for administrators; any phone change signs the person out everywhere and is audited (masked) |
| Administrators could sign out the owner; session IDs visible in the audit log | Low | **Fixed** |
| Self-review of tasks; self-decided scope changes; one person giving both leave approvals | Low | **Fixed** |
| `deliverables.review` capability not enforced | Low | **Fixed** |
| OTP delivery timing could reveal accounts (production); parallel guesses could exceed the attempt limit | Low | **Fixed** — delivery not awaited; attempts reserved atomically |
| Idempotency fingerprint ignored multipart bodies | Low | **Fixed** — uploads are not replayed |
| Any ZIP accepted | Low | **Fixed** — only Office Open XML |
| Malformed-JSON errors had no request ID | Low | **Fixed** |
| Error logs could include SQL parameters | Low | **Fixed** — parameters stripped |
| Confidential attachment names visible in task detail | Low | **Fixed** for task attachments |
| Reward amounts readable in the audit log by administrators | Low | **Fixed** — redacted without `rewards.view_all` |

### Known residual risks (accepted for Phase 1, tracked)

- **CSRF token not bound to the session** (double-submit with an unbound token).
  Exploitation also needs cookie injection on the same site; SameSite=Lax, JSON-only
  bodies and the CORS allow-list remain. Planned: HMAC(session) tokens and `__Host-` cookies.
- **SMS and email are at-least-once.** A worker that crashes after the provider accepted
  a message but before the attempt is recorded will send it again on retry (the email
  keeps its Message-ID; MSG91 drops identical SMS to the same number within 10 seconds).
- **Push device tokens are not tied to sessions.** A token re-registered by another
  signed-in person moves to them (shared phones); revoking a session does not stop
  pushes until the app unregisters. Planned: link devices to sessions.
- **Sign-in lockout:** anyone can exhaust a number's verification attempts for 15
  minutes (inherent to per-number limits). Monitor `rate_limit_counters`.
- **Deliverable version history** shows file names even when a file is confidential.
- **Cross-project titles in some notifications** (priority conflicts to each project's
  manager) and in a requester's own leave-impact list.
- **Some checks use role names** (command-center and reports entry for project managers)
  rather than capabilities; editing role capabilities does not change them. Budget
  visibility now follows `projects.manage_any` plus the project's manager and owner.
- **No version check** on replacing project members, task collaborators and template
  archive; a few lists (deliverables, site updates, comments, blockers) are unpaginated.
- **Idempotency** has no in-flight lock: two identical concurrent requests can both run.
- When the owner requests leave and no administrator holds `leave.approve_any`, the
  owner approves their own leave (a studio owner's prerogative).

### Dependency audit — 2026-10-21 (`pnpm audit --prod`)

| Advisory | Path | Assessment |
|---|---|---|
| node-forge RSA signature check (high, no fix released) | `expo › @expo/cli` | Development/build tooling only; not shipped in the app bundle or the servers. Re-check on each Expo SDK update. |
| braces stack exhaustion (high, no fix released) | `expo › metro › micromatch` | Bundler tooling only. |
| uuid bounds check (moderate) | `expo › @expo/config-plugins › xcode` | Native project generation only. |
| ts-deepmerge prototype override (moderate) | `@ts-rest/open-api › @anatine/zod-openapi` | Runs only when building the OpenAPI document from our own contract (not user input); `/docs` is not mounted in production. |
| js-yaml CPU use (moderate) | `@nestjs/swagger` | **Patched** via `overrides` in `pnpm-workspace.yaml`. |

CI fails on any critical advisory (`pnpm audit --prod --audit-level=critical`).
