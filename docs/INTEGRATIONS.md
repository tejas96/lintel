# Integrations

Every external service sits behind an application port, has a development
adapter, and is selected by validated configuration. Raw research notes with
source links: `docs/research/INTEGRATION_RESEARCH_2026-10-21.md`.

| Service | Port | Production adapter | Development adapter | Status |
|---|---|---|---|---|
| SMS OTP | `OtpProvider` | `Msg91OtpProvider` | `LocalDevelopmentOtpProvider` (code in API log) | Adapter unit-tested against the documented contract; **not verified against the live MSG91 API** (needs credentials) |
| Object storage | `ObjectStorage` | `RustFsObjectStorage` (S3 API) | same, local RustFS container | Verified locally (bucket, put, get, health) |
| Push | `PushProvider` | `FirebasePushProvider` (firebase-admin) | `LogPushProvider` (records, reports `not_configured`) | FCM adapter compiled and unit-tested for error mapping; **not verified against real devices** (needs a Firebase project) |
| Notification SMS | `SmsSender` | `Msg91SmsSender` (MSG91 Send SMS / flow API) | `DevelopmentSmsSender` (worker log, reports `not_configured`) | Unit-tested against the documented request with mocked HTTP; **not verified against the live MSG91 API** (needs credentials, a template and its DLT registration) |
| Notification email | `EmailSender` | `SmtpEmailSender` (Nodemailer 10.1.7) | `DevelopmentEmailSender` (worker log, reports `not_configured`) | Unit-tested with a mocked transport; **not verified against a real SMTP server** |
| Web push | `PushProvider` (web installations) | `FirebasePushProvider` → `fid` targets | — (hidden without `NEXT_PUBLIC_FIREBASE_*`) | Client unit-tested with a mocked Firebase SDK; **not verified with a real Firebase project and browser** |
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

## Notification channels (SMS, email, web push)

Who gets what is decided by the domain policy (`packages/domain/src/notifications`):
in-app always; push unless turned off (held during quiet hours unless urgent);
**SMS only for urgent kinds** the person opted into, when `SMS_NOTIFICATIONS_ENABLED`;
**email per kind** (opt-in) when `EMAIL_NOTIFICATIONS_ENABLED`, immediately or held for
the person's **daily digest** (urgent kinds always go immediately; quiet hours never hold
email). The Notifier writes one `notification_deliveries` row per channel and an outbox
event per SMS/immediate email (`NotificationMessageQueued`); the worker relays it to
`messageDeliveryWorkflow` (ID `notification:<id>:<sms|email>`), which sends with six
retries and writes **one `notification_delivery_attempts` row per attempt** (written
before the provider is called, finished after). Development senders record and report
`not_configured`, so such deliveries are `skipped`, never `sent`.

### MSG91 notification SMS

- API: `POST https://control.msg91.com/api/v5/flow`, headers `authkey`,
  `accept: application/json`, `content-type: application/json`; body
  `{"template_id", "short_url": "0", "realTimeResponse": "1", "recipients": [{"mobiles": "91XXXXXXXXXX", "link": "https://…"}]}`.
  Success is `{"type":"success","message":"<request id>"}`; like the OTP API the adapter
  decides on `type`. `short_url` is "1 (On) or 0 (Off)" (we send our own link);
  `realTimeResponse` "provides a real-time response … addressing most API error codes".
  Template variables are case-sensitive (`##link##` ↔ `link`); `mobiles` is international
  format without "+".
- **Content:** never the notification's title or body. Register this generic text (one
  variable) as the MSG91 template and on the DLT portal:
  `Lintel: an urgent update is waiting for you. Open ##link## to see it.`
  The link is `WEB_BASE_URL` + the notification's in-app path (re-checked on open).
- **DLT:** the DLT template ID is attached to the MSG91 template when it is created
  (`/api/v5/sms/addTemplate`, field `dlt_template_id`, "If you fall in the DLT criteria of
  India, enter your DLT Template ID."). The flow API itself takes only `template_id`, so
  Lintel requires `MSG91_SMS_DLT_TEMPLATE_ID` in configuration and records
  `msg91: <template> (DLT <id>)` on every attempt row for audits.
- Errors are mapped to safe text (auth key, DLT, template, number, balance, IP); HTTP
  5xx/429 and network failures are retried, others fail the delivery. MSG91's error code
  list: https://msg91.com/help/what-are-the-reason-for-error-codes-received-under-the-api-failed
- Configuration: `SMS_NOTIFICATIONS_ENABLED=true`, `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`,
  `MSG91_SMS_TEMPLATE_ID`, `MSG91_SMS_DLT_TEMPLATE_ID` (numeric), shared `MSG91_BASE_URL`
  and `MSG91_TIMEOUT_MS`.
- Sources: https://docs.msg91.com/sms/send-sms.md · https://docs.msg91.com/sms/module.json
  (Send SMS, Add Template) · the error-code article above.
- **UNVERIFIED:** the exact error body of the flow API (assumed `{"type":"error","message"}`
  as for OTP; any non-success `type` is treated as a failure); whether DLT rules require
  the link's domain to be whitelisted with the operator (reported widely, not in MSG91's
  docs); the optional tracking parameters (`clientId`, `CRQID`, `UUID`) the docs mention
  are not sent because their placement is not documented.

### Email (SMTP, Nodemailer 10.1.7)

- Options used (checked against Nodemailer's shipped type definitions and
  https://www.nodemailer.com/smtp): `host`, `port` (default 587), `secure` (TLS from the
  first byte; Lintel defaults it to true only for port 465), `requireTLS` (refuse to send
  unless STARTTLS succeeds; `SMTP_REQUIRE_TLS`, default true), `auth {user, pass}`,
  `connectionTimeout`/`greetingTimeout`/`socketTimeout`, and `disableFileAccess` /
  `disableUrlAccess` (Lintel only sends text it rendered).
- Each email has a plain-text part and an HTML part (Linen & Cyanotype colours, system
  fonts, `lang`, presentation tables, dark scheme via `prefers-color-scheme`), a
  deterministic `Message-ID` (`<notification.<id>@<web host>>`, `<digest.<id>@…>`) so a
  retried send is recognisable, and `Auto-Submitted: auto-generated` (RFC 3834) so mail
  servers do not answer it with out-of-office replies. Sensitive kinds (rewards, leave
  decisions) read "You have a private update" — details stay in the app.
- Failures: 4xx replies and connection trouble are retried; credentials, TLS and 5xx
  replies fail the delivery. Server text is never stored (it can contain the address).
- **Daily digest:** the `lintel-email-digest` Temporal Schedule runs at
  `EMAIL_DIGEST_TIME` (default 18:00) in the studio timezone. For each person with
  emails held in delivery status `digest` it sends one email (sections in the account
  page's order, most pressing first, at most 40 items plus "and N more"), records one
  `email_digests` row per person and day (a re-run never sends twice) and marks the held
  deliveries sent. **Nobody with nothing held gets an email.** A digest that keeps
  failing is marked failed and its emails wait for the next day.
- Configuration: `EMAIL_NOTIFICATIONS_ENABLED=true`, `EMAIL_PROVIDER=smtp`, `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`/`SMTP_PASSWORD` (both or
  neither), `SMTP_FROM` ("Name <address>"), `SMTP_TIMEOUT_MS`, `EMAIL_DIGEST_TIME`.
  People need an email address on their profile (administrators add it).
- **UNVERIFIED:** delivery and rendering with a real provider and real mail clients
  (Gmail/Outlook dark-mode handling in particular).

### Web push (Firebase Cloud Messaging for the web app)

- Client: `firebase` 12.19.0 (`@firebase/messaging` 0.13.3, same as 13.0.0). Lintel uses
  the recommended **Firebase Installation ID** API — `register(messaging, {vapidKey,
  serviceWorkerRegistration})` plus `onRegistered` — not the deprecated `getToken()`; the
  docs warn against mixing the two. The installation ID is stored through
  `POST /v1/devices` with `platform: "web"`, `tokenType: "fcm_fid"`; the server sends to it
  with `{fid}` (firebase-admin 14.5 `FidMessage`).
- Permission is asked only after a press, never on page load: on **Today** a card offers
  it once ("Hear about changes as they happen" → **Turn on** / **Not now**, like the phone
  app; shown only while the browser has not been asked yet), and at any time with
  **Turn on in this browser** in Account → Notifications. Signing out (and **Turn off**)
  deletes the device row, calls `unregister()` and removes the service worker registration.
- Service worker: `apps/web/service-worker/firebase-messaging-sw.ts`, bundled with esbuild
  into `apps/web/public/firebase-messaging-sw.js` (git-ignored) on every web build. The
  page registers it with the public web config in its URL and scope
  `/firebase-cloud-messaging-push-scope`, so it never controls Lintel's pages. It is served
  `no-store`, with its own CSP (`script-src 'self'`, `connect-src` Google APIs) and
  outside the sign-in proxy.
- Background messages with a `notification` payload are shown by the SDK; a click opens
  `webpush.fcmOptions.link` ("Click actions support only secure HTTPS URLs"), which the
  server sets to `WEB_BASE_URL` + the in-app path when that is https. While a Lintel tab
  has focus the page receives the message and refreshes the inbox.
- Configuration (public, inlined at build time): `NEXT_PUBLIC_FIREBASE_API_KEY`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
  `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Firebase console →
  Project settings → Cloud Messaging → Web Push certificates). When any is missing the
  feature hides itself and Firebase is never downloaded. Docker builds take them as build
  args. The server side needs `PUSH_PROVIDER=fcm` and the service account as before.
- Sources: https://firebase.google.com/docs/cloud-messaging/js/client ·
  https://firebase.google.com/docs/cloud-messaging/js/receive · the type definitions of
  `@firebase/messaging` 0.13.3 and `firebase-admin` 14.5 (`WebpushConfig`,
  `WebpushFcmOptions`, `FidMessage`).
- **UNVERIFIED:** an end-to-end send to a real browser by installation ID (no Firebase
  project); Safari/iOS web push (needs a home-screen web app with a manifest, which Lintel
  does not ship yet).

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
| Nodemailer | 10.1.7 | npm registry; ships its own types; 10.1.x carries the connection and parsing hardening |
| Firebase JS SDK | 12.19.0 (`@firebase/messaging` 0.13.3) | npm registry; same messaging package as 13.0.0, without the new major |
| esbuild | 0.28.2 | already in the lockfile (via tsx); bundles the web push service worker |
| Playwright / @axe-core/playwright | 1.62.1 / 4.13.0 | 1.62.1 drives Chromium build 1234 (Chrome for Testing 151.0.7922.34), already cached locally; axe-core 4.13 |
