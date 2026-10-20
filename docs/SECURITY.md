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
- Sensitive fields are filtered on the server: budgets (owner/admin/PM only),
  reward amounts (the person or `rewards.view_all`), phone numbers always masked
  in directory views.
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
`AI_FEATURES_ENABLED=true`.

## Pre-deployment security checklist

- [ ] Fresh `SESSION_SECRET` (≥ 48 random bytes), storage keys, database password.
- [ ] MSG91 auth key with IP allow-listing; DLT-approved template for +91 numbers.
- [ ] Firebase service account restricted to FCM; APNs key uploaded to Firebase.
- [ ] HTTPS everywhere; API and web on the same site; `COOKIE_SECURE=true`.
- [ ] `CORS_ALLOWED_ORIGINS` lists only the production web origin.
- [ ] PostgreSQL, RustFS and Temporal reachable only on the private network.
- [ ] Backups configured and a restore tested (`OPERATIONS.md`).
- [ ] `pnpm audit --prod` reviewed; no critical advisories open.
- [ ] Owner account phone verified; administrator roles reviewed.
- [ ] Log retention and access reviewed (logs contain masked phones only).
- [ ] Penetration test of sign-in, file download and project-scoped routes.
