# Integrations

Every external service sits behind an application port, has a development
adapter, and is selected by validated configuration. Raw research notes with
source links: `docs/research/INTEGRATION_RESEARCH_2026-10-21.md`.

| Service | Port | Production adapter | Development adapter | Status |
|---|---|---|---|---|
| SMS OTP | `OtpProvider` | `Msg91OtpProvider` | `LocalDevelopmentOtpProvider` (code in API log) | Adapter unit-tested against the documented contract; **not verified against the live MSG91 API** (needs credentials) |
| Object storage | `ObjectStorage` | `RustFsObjectStorage` (S3 API) | same, local RustFS container | Verified locally (bucket, put, get, health) |
| Push | `PushProvider` | `FirebasePushProvider` (firebase-admin) | `LogPushProvider` (records, reports `not_configured`) | FCM adapter compiled and unit-tested for error mapping; **not verified against real devices** (needs a Firebase project) |
| Workflows | `WorkflowScheduler` | `TemporalWorkflowScheduler` | same, local Temporal dev server | Verified locally |
| AI (Phase 2) | `AiAssistant` | — | `DisabledAiAssistant` | Disabled by design |

## MSG91 (OTP)

- API: classic v5. `POST https://control.msg91.com/api/v5/otp?template_id=…&mobile=91XXXXXXXXXX&otp=…&otp_length=6&otp_expiry=5`
  with header `authkey`. Success is `{"type":"success","request_id":…}` — MSG91 can
  answer HTTP 200 for errors, so the adapter checks `type`.
- Lintel generates the code and verifies it itself (ADR 0005), so MSG91's verify
  and retry endpoints are not used; "resend" sends a new code.
- Configuration: `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`,
  optional `MSG91_BASE_URL`, `MSG91_TIMEOUT_MS` (default 8000).
- To enable: create an OTP template in the MSG91 panel containing `##OTP##`; for
  Indian numbers register it on the DLT portal and use the approved template ID
  (UNVERIFIED in official docs, reported widely); allow-list the server IP for the
  auth key; set the variables; restart; sign in with a real number and confirm the
  SMS. Provider errors are mapped to safe messages and never shown verbatim.

## RustFS (object storage)

- Image `rustfs/rustfs:1.0.0` (already local). S3 API on container port 9000
  (host 9110), console 9001 (host 9111). Credentials via `RUSTFS_ACCESS_KEY` /
  `RUSTFS_SECRET_KEY`; data in the named volume `lintel-objects` at `/data`
  (the container runs as uid 10001; named volumes need no chown).
- Path-style addressing is required (`forcePathStyle: true`) unless
  `RUSTFS_SERVER_DOMAINS` is configured. Region `us-east-1`.
- Health: `GET /health` on the S3 port; the API readiness check uses `HeadBucket`.
- The API creates the bucket at startup when `STORAGE_AUTO_CREATE_BUCKET=true`
  (development). In production create the bucket during provisioning and keep it private.
- Files are uploaded through the API (validated, size-limited) and downloaded
  through `GET /v1/files/:id/content` after an access check; storage is never
  exposed to browsers or phones directly.

## Firebase Cloud Messaging (push)

- Server: firebase-admin 14.5 (`engines: node >= 22`), credentials
  `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (escaped
  `\n` are converted). Never shipped to web or mobile bundles.
- Tokens are deprecated in favour of Firebase Installation IDs since admin 14.1,
  but still work; migrating `device_tokens.token_type` to `fcm_fid` is a planned follow-up.
- Dead tokens (`registration-token-not-registered`, `installation-id-not-registered`,
  `invalid-registration-token`) revoke the device; rate/availability errors are retried
  by the Temporal activity with backoff.
- Android: add `google-services.json` and `expo.android.googleServicesFile`; a
  notification channel is created before asking for permission (Android 13+).
- iOS: `getDevicePushTokenAsync()` returns an **APNs** token. To deliver iOS push
  through FCM, add the Firebase iOS SDK (`@react-native-firebase/app` + `messaging`),
  `GoogleService-Info.plist`, the `aps-environment` entitlement, and upload an APNs
  authentication key (Key ID + Team ID) in Firebase Console → Cloud Messaging.
  Until then the API records iOS devices with `token_type=apns` and marks their
  deliveries `skipped` with the reason, rather than claiming delivery.
- Requires an Apple Developer Program membership for APNs keys and signing.

## Temporal

- SDK 1.24.0 (`@temporalio/*`), Node ≥ 20.3, glibc base image for production containers.
- Local: CLI dev server (`temporalio/admin-tools:1.30.6`, `temporal server start-dev
  --db-filename … --namespace lintel`) on :7240, UI on :8240, history persisted in
  the `lintel-temporal` volume.
- Production: `temporalio/server:1.30.6` with PostgreSQL persistence, schema via
  `temporal-sql-tool`, namespace `lintel`; workers in `apps/worker`.
- Workflow IDs are derived from records (`task-deadline:<taskId>`,
  `notification:<id>`, …) with `workflowIdConflictPolicy: USE_EXISTING`, so
  starting twice is harmless.

## Version and compatibility record (verified 2026-10-21)

| Component | Version | Source / rationale |
|---|---|---|
| Node.js | 22.22 (local) | Required ≥ 22 by firebase-admin 14 and Expo SDK 58 |
| pnpm / Turborepo / Biome | 10.34.5 / 2.11.9 / 2.5.15 | npm registry |
| TypeScript | 5.9.3 | ADR 0009 |
| NestJS | 11.2.7 | ts-rest/nest peer range (ADR 0002) |
| ts-rest | 3.52.1 | latest stable (ADR 0002) |
| Zod | 3.25.76 | ts-rest peer range |
| Next.js / React | 16.4.2 / 19.3.1 | npm registry |
| Tailwind CSS | 4.3.3 | npm registry |
| Expo SDK / React Native | 58 / 0.88.0 | `expo@58.0.16` bundledNativeModules |
| Drizzle ORM / Kit | 0.45.4 / 0.31.11 | latest stable (1.0 still RC) |
| PostgreSQL | 17 (`postgres:17-alpine`, local) | brief |
| Temporal SDK / server | 1.24.0 / 1.30.x | npm + local images |
| firebase-admin | 14.5.0 | npm registry |
| AWS SDK S3 | 3.1153.0 | used for RustFS |
