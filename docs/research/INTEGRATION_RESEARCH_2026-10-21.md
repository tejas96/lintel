# Integration research notes — 2026-10-21

Raw findings from official documentation and from the published npm packages
and local Docker images. `docs/INTEGRATIONS.md` turns these into decisions.
Items marked UNVERIFIED could not be confirmed in official docs.

## MSG91 OTP (classic v5 API)

- Base URL `https://control.msg91.com`. Responses are HTTP 200 even for many errors — check `type`.
- Send: `POST /api/v5/otp?template_id=&mobile=` with header `authkey`, `content-type: application/json`;
  JSON body holds template variables. Query `otp` lets the caller supply its own OTP.
  `otp_length` 4–9 (default 4), `otp_expiry` minutes (default 15). Success: `{"type":"success","request_id":"…"}`.
- Verify: `GET /api/v5/otp/verify?otp=&mobile=` header `authkey`. Success `{"type":"success","message":"OTP verified success"}`.
- Retry: `GET /api/v5/otp/retry?authkey=&retrytype=text&mobile=` (default retrytype is voice; limit 2).
- Errors: "Auth Key missing" (401), "The provided flow ID or template ID is invalid.", "OTP expired",
  "OTP not match", "Invalid authkey" (401, code 201), "OTP retry count maxed out".
- `mobile` is international format without "+", e.g. `919999999999`.
- UNVERIFIED (search results only): new authkeys have IP whitelisting on by default; +91 numbers need a DLT-approved template.
- Sources: https://docs.msg91.com/otp/sendotp.md · https://docs.msg91.com/otp/verify-otp.md ·
  https://docs.msg91.com/otp/resend-otp.md · https://docs.msg91.com/otp/module.json

## RustFS (`rustfs/rustfs:1.0.0`, newest tag 1.0.3)

- `RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` (or `_FILE` variants). Default `rustfsadmin` if unset (warning).
- `RUSTFS_VOLUMES` default `/data`; S3 API `:9000`, console `:9001`; `RUSTFS_CONSOLE_ENABLE=true`.
- Runs as uid/gid 10001 — bind mounts need `chown -R 10001:10001`; named volumes need nothing.
- Health: `GET :9000/health` → 200 JSON; `/health/ready`; image contains curl and wget.
- S3: path-style addressing required (unless `RUSTFS_SERVER_DOMAINS`), region `us-east-1` works,
  presigned GET/PUT work with `@aws-sdk/client-s3` 3.1153.0.
- The local 1.0.0 image is x86_64 and runs under emulation on Apple silicon.
- Sources: https://github.com/rustfs/rustfs · https://docs.rustfs.com/installation/container/docker

## Temporal TypeScript SDK 1.24.0

- npm engines node `>= 20.3.0`. glibc base image required (not Alpine).
- Run the worker as its own long-lived process; prebuild workflow bundle with `bundleWorkflowCode` for production.
- Workflow code: deterministic sandbox, import activity *types* only.
- `proxyActivities({ startToCloseTimeout, retry })`; retry defaults: 1s initial, ×2, max 100× initial, unlimited attempts.
- Workflow ID policies: `workflowIdReusePolicy` (`ALLOW_DUPLICATE` default, `REJECT_DUPLICATE`, …),
  `workflowIdConflictPolicy` (`FAIL`, `USE_EXISTING`, `TERMINATE_EXISTING`).
- Schedules: `client.schedule.create({ scheduleId, spec, action, policies })`; existing ID throws `ScheduleAlreadyRunning`.
- Dev server: `temporal server start-dev --db-filename --ip 0.0.0.0 --namespace --ui-port`. Present in local
  `temporalio/admin-tools:1.30.6` (CLI 1.6.1, Server 1.30.1, UI 2.45.3).
- Testing: time-skipping server needs Rosetta 2 on ARM; `createFromExistingServer()` and `MockActivityEnvironment` exist.
- Sources: https://docs.temporal.io/develop/typescript/workers/run-worker-process ·
  https://docs.temporal.io/develop/typescript/testing-suite · https://docs.temporal.io/cli/server ·
  https://docs.temporal.io/develop/typescript/schedules

## Firebase Cloud Messaging (firebase-admin 14.5.0, engines node >= 22)

- `getMessaging().send(message)`, `sendEach`, `sendEachForMulticast` (≤ 500). Legacy APIs removed in v14.
- 14.1.0 deprecates `token` targets in favour of Firebase Installation IDs (`fid`); tokens still work.
- Delete target on `messaging/registration-token-not-registered` or `messaging/installation-id-not-registered`;
  `messaging/invalid-registration-token` only when the payload is known valid.
  Retryable: `message-rate-exceeded`, `device-message-rate-exceeded`, `server-unavailable`, `internal-error`.
- Credentials: `GOOGLE_APPLICATION_CREDENTIALS` + `applicationDefault()`, or `cert({projectId, clientEmail, privateKey})`.
- Expo: `getDevicePushTokenAsync()` returns an FCM token on Android but an **APNs token on iOS**.
  iOS through FCM needs the Firebase iOS SDK (`@react-native-firebase/messaging`), `GoogleService-Info.plist`,
  an APNs auth key uploaded to Firebase, and the `aps-environment` entitlement. Push needs a development build.
  Android 13+: create a notification channel before requesting the token.
- Sources: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk ·
  https://firebase.google.com/docs/cloud-messaging/manage-tokens · https://docs.expo.dev/versions/latest/sdk/notifications/

## ts-rest

- All packages `latest` 3.52.1 (2025-03-04); `rc` 3.53.0-rc.1 (2025-06-02). Maintenance mode; v4 is a draft PR.
- `@ts-rest/nest` peers NestJS `^9 || ^10 || ^11`; core/open-api peer `zod ^3.22.3`.
- Nest pattern: `@TsRestHandler(contract)` + `tsRestHandler(contract, {...})`; `TsRestModule.register({ isGlobal: true, validateResponses })`.
- `generateOpenApi(router, info, { setOperationId })` → feed to `SwaggerModule.setup`.
- Sources: https://ts-rest.com/server/nest · https://github.com/ts-rest/ts-rest/pull/863

## Expo SDK 58

- expo 58.0.16, React Native 0.88.0, React 19.3.0, expo-router ~58.0.24, expo-notifications ~58.1.5,
  expo-secure-store ~58.0.2. Node `^22.13.0 || ^24.3.0`. Min Android 7, iOS 16.4.
- pnpm monorepos supported out of the box; isolated installs supported since SDK 54
  (fallback: `nodeLinker: hoisted`).
- SDK 58: foreground notifications shown by default unless `setNotificationHandler` says otherwise.
- Sources: https://docs.expo.dev/versions/latest/ · https://expo.dev/changelog/sdk-58 · https://docs.expo.dev/guides/monorepos/
