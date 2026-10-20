# Lintel mobile (`@lintel/mobile`)

The iOS and Android app for designers, site supervisors, team leads and managers.
Expo SDK 58 (React Native 0.88, React 19.3) in the managed workflow with
**Continuous Native Generation**: `ios/` and `android/` are generated from
[`app.config.ts`](./app.config.ts) by `expo prebuild` and are git-ignored. Never edit them by hand.

The app talks to the API only through the shared ts-rest contract
(`@lintel/api-contracts`). Business rules — priorities, status transitions, leave
impact, who may decide what — come from the server; the app only presents them.

## What's in the app

| Area | Screens |
| --- | --- |
| Sign-in | Phone number → 6-digit code (SMS autofill, paste, auto-submit), resend countdown, rate-limit messages |
| Today | Server-ordered queue: next-up hero with the server's headline and reasons, workload, buckets (overdue / today / coming up / waiting / blocked / in review / later), reviews waiting for you. Swipe right to start, swipe left for blocker / more, long-press for the action sheet |
| Task | Server `transitions` as buttons (refused ones with the server's reasons), work session start/pause with live timer, checklist (instant ticks with rollback), blockers (report / resolve), deliverables, files (camera, photos, Files with upload progress), linked work, comments |
| Projects | Search + list with health, stage and next milestone; project summary with stage tracker, health reasons, milestones, team, deliverables, site log |
| Site | For site supervisors: pick a site, see its log, post photos + note + issue flag |
| Leave | Balances, my requests / to decide, new request with range calendar, live impact preview (days, conflicts, overlaps, warnings, blocking problems) and handover proposals; request detail with approval chain, decide / ask for info / cancel / respond, handovers |
| Approvals | `GET /me/approvals` grouped by kind; deliverable review (approve / request changes / reject), task review via the task's transitions, leave decisions |
| Inbox | Notifications with unread state, mark read / all read, deep links via `linkPath` |
| Account | Profile, push permission, quiet hours, signed-in devices with revoke, sign out |

Tabs follow **capabilities**, not role names (`src/session/capabilities.ts`): everyone gets
Today, Projects and Inbox; Approvals appears for people who review or approve; Site appears
for people who post site updates but don't make decisions (site supervisors); Leave appears
with `leave.request`. Account opens from the avatar on every tab.

## Architecture

```
src/
  app/            expo-router routes only (thin files that export a screen)
  features/       screens and their parts, one folder per area
  components/     design primitives (text, buttons, cards, status pills, skeletons, lists, sheets)
  theme/          tokens → React Native (colours, type, motion, status vocabulary)
  api/            ts-rest client, errors, uploads, query client, idempotency keys
  queries/        TanStack Query hooks per API module
  session/        secure-store session, capabilities, heartbeat
  push/           permission, device registration, deep links from notifications
  feedback/       haptics, toasts, offline banner
  formatting/     dates (calendar dates never shift timezone), durations, sizes
```

- **Design tokens**: `@lintel/design-system/tokens` is a path alias (tsconfig `paths`, which
  Metro also honours) to `packages/design-system/src/tokens`. Only the platform-neutral token
  files are imported — never web components.
- **Fonts**: Newsreader (display), Geist (UI) and Geist Mono, loaded per weight from
  `@expo-google-fonts/*` before the splash screen hides.
- **Motion**: Reanimated 4 with `ReduceMotion.System` everywhere; the only loop is the skeleton
  pulse, which stops under Reduce Motion.
- **Networking**: bearer token from `expo-secure-store`; 2xx bodies are validated against the
  contract; commands (POST/PUT/PATCH/DELETE) send an `Idempotency-Key` and are retried once after
  a network failure, so a flaky connection never applies a change twice. A 401 on an
  authenticated request ends the session and returns to sign-in with a notice.
- **Online-first**: queries pause while offline and the banner says so; changes are never queued
  for later. There is no offline mode.

## Setup

Requirements: Node ≥ 22.13, pnpm 10, the Lintel API running (see the root `AGENTS.md`).
iOS: Xcode 26 with an iOS 26 simulator and CocoaPods. Android: Android SDK (platform 36),
an emulator image and JDK 17.

```bash
pnpm install
pnpm build                       # the app imports the built contract/domain/shared packages
```

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:4106` | API base URL, inlined at bundle time. On the Android emulator `localhost`/`127.0.0.1` is rewritten to `10.0.2.2`. On a physical phone use your computer's LAN address, e.g. `http://192.168.1.20:4106`. |
| `LINTEL_GOOGLE_SERVICES_JSON` | `./google-services.json` | Optional. Android Firebase config for FCM. Used only if the file exists. |
| `LINTEL_GOOGLE_SERVICE_INFO_PLIST` | `./GoogleService-Info.plist` | Optional. iOS Firebase config (only needed with the Firebase iOS SDK, see Push). |
| `LINTEL_APNS_ENVIRONMENT` | `development` | `production` for TestFlight / App Store builds (`aps-environment` entitlement). |

Put them in `apps/mobile/.env` (git-ignored) or export them before running a command.

## Running

This app uses native modules beyond Expo Go, so run it as a **development build**.

```bash
cd apps/mobile
export LANG=en_US.UTF-8          # CocoaPods 1.16 on Ruby 4 fails without a UTF-8 locale

# iOS simulator: prebuild, pod install, build, install and start Metro
npx expo run:ios --device "iPhone 17 Pro" --port 8106

# Android emulator (start it from Android Studio or `emulator -avd Pixel_8_API_36`)
npx expo run:android --port 8106

# After the first native build, JS changes only need Metro
npx expo start --dev-client --port 8106
```

Sign in with `+91 90000 00001` (owner) … `00006` (designer) … `00010` (site supervisor);
the code is `123456` when the API runs with `OTP_DEVELOPMENT_CODE=123456`.

Checks:

```bash
pnpm --filter @lintel/mobile typecheck
pnpm lint && pnpm check:file-size
pnpm --filter @lintel/mobile export:ios
pnpm --filter @lintel/mobile export:android
```

## Push notifications

The flow in the app:

1. Never at launch. Today shows a short explanation card the first time; "Turn on" (or
   Account → Push notifications) asks for permission.
2. Android: the `work-updates` channel is created **before** asking (Android 13+ requires it).
3. The native device token is read with `getDevicePushTokenAsync()` and registered with
   `POST /v1/devices` — `tokenType: "fcm"` on Android, `tokenType: "apns"` on iOS. It is
   re-registered on every launch and whenever the OS rotates it.
4. Sign-out calls `DELETE /v1/devices/:id` before ending the session.
5. Tapping a notification opens the screen for its `data.linkPath`
   (`src/push/link-routing.ts`); unknown links open the Inbox. Pushes received in the
   foreground show a banner and refresh the inbox, queue and approvals.

Missing Firebase files never break a build: `app.config.ts` only sets `googleServicesFile`
when the file exists; without it the app explains that push isn't set up in this build.

### Android (FCM)

1. Firebase console → add an Android app with package `studio.lintel.app`.
2. Download `google-services.json` to `apps/mobile/google-services.json` (git-ignored) or point
   `LINTEL_GOOGLE_SERVICES_JSON` at it, then rebuild (`npx expo prebuild --clean` or
   `expo run:android`).
3. The API needs `PUSH_PROVIDER=fcm` and the service-account variables (`FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — see `docs/INTEGRATIONS.md`.

### iOS (APNs, and FCM for iOS)

Expo returns an **APNs** device token on iOS. The API registers it as `apns`, but its FCM
provider can only deliver to FCM tokens, so iOS deliveries are recorded as skipped until one
of these is done:

- **Recommended:** add the Firebase iOS SDK (`@react-native-firebase/app` +
  `@react-native-firebase/messaging`, which needs `useFrameworks: "static"` via
  `expo-build-properties`), put `GoogleService-Info.plist` in `apps/mobile/` (or set
  `LINTEL_GOOGLE_SERVICE_INFO_PLIST`), read the FCM token with `messaging().getToken()` and
  register it as `tokenType: "fcm"`.
- In every case: an Apple Developer Program team, the Push Notifications capability on the App
  ID `studio.lintel.app`, an **APNs authentication key** (.p8, with Key ID and Team ID) uploaded
  in Firebase Console → Project settings → Cloud Messaging, and the `aps-environment`
  entitlement (added by the `expo-notifications` plugin; `LINTEL_APNS_ENVIRONMENT=production`
  for release).

Remote push on the iOS simulator needs Xcode's simulator push support; test real delivery on a
device.

## Release builds and signing

Native projects are regenerated for every release (`npx expo prebuild --clean`). EAS Build can
manage credentials for both stores; the manual requirements are:

**iOS**
- Apple Developer Program membership and an App ID `studio.lintel.app` with Push Notifications.
- A distribution certificate and an App Store provisioning profile (Xcode automatic signing or
  EAS credentials). Never commit `.p12`, `.p8` or `.mobileprovision` files (git-ignored).
- The APNs key above; `LINTEL_APNS_ENVIRONMENT=production`.
- Bump `version` (marketing) and `ios.buildNumber` in `app.config.ts`; App Store Connect record;
  the export-compliance flag is already set (`ITSAppUsesNonExemptEncryption: false`).

**Android**
- An **upload keystore** (`keytool -genkeypair -v -storetype PKCS12 -keystore upload.keystore
  -alias lintel-upload -keyalg RSA -keysize 2048 -validity 10000`), kept out of git (the
  `*.keystore` / `*.jks` patterns are ignored) and backed up securely.
- **Play App Signing** enabled in Play Console (Google holds the app signing key; you sign
  uploads with the upload key). Configure the release signing config through EAS credentials or
  a config plugin that reads the keystore path and passwords from environment variables.
- Bump `version` and `android.versionCode` in `app.config.ts`.
- `google-services.json` for the production Firebase project.

Point `EXPO_PUBLIC_API_URL` at the production HTTPS API for release builds.

## Verification status (2026-10-21)

Verified on this machine (macOS, Xcode 26.6, iOS 26.5 simulator, Node 22.22) against the real
API on `:4106` with the demo seed (`db:seed` + `db:seed:demo`):

- `pnpm --filter @lintel/mobile typecheck` (app and `app.config.ts`), `pnpm --filter @lintel/mobile test`
  (vitest: link routing, date/quantity formatting, capability tabs), `pnpm lint`,
  `pnpm check:file-size`, `pnpm check:boundaries`, repo-wide `pnpm typecheck` / `pnpm test`.
- `expo export --platform ios` and `--platform android` bundle (Hermes bytecode, ~5.2 MB each).
  The source map shows one copy each of react, react-native, expo and expo-modules-core (Expo's
  sticky resolution handles pnpm peer variants; no custom Metro config needed).
- `expo install --check`: all native modules match SDK 58 (TypeScript is deliberately kept at
  the repo's 5.9.3 instead of the suggested ~6.0.3; listed in `expo.install.exclude`).
- iOS development build: `expo prebuild` + `pod install` + `xcodebuild` (Debug, simulator)
  succeeded and ran on the iPhone 17 Pro simulator. Walked through with real data: sign-in
  (phone + code) for the designer, team lead and site supervisor; Today (server queue, next-up
  reasons, swipe-to-start, start/pause); task detail (server transitions and reasons, checklist,
  deliverable); file upload with progress and deliverable version submission; leave request
  with live impact preview and handover picker; approvals (deliverable approved, leave approved
  at level 1 of 2); inbox; projects and project summary; site update with two photos;
  account (push permission, sessions, sign out → device unregistered); dark mode.
- Push on the simulator: permission prompt, APNs token obtained and registered as
  `tokenType: "apns"` (`POST /v1/devices` 200), simulated push (`xcrun simctl push`) shown as a
  banner and the tap deep-linked to the task from `linkPath`; sign-out sent `DELETE /v1/devices/:id`.
- Android development build: `expo prebuild --platform android` + `./gradlew assembleDebug`
  (arm64, JDK 17) — BUILD SUCCESSFUL; installed on the Pixel 8 API 36 emulator (Metro via
  `adb reverse tcp:8106 tcp:8106`, API at `10.0.2.2:4106` rewritten automatically). Verified sign-in,
  Today, Account, the `work-updates` channel being created before the Android 13+ permission
  prompt, and the "push isn't set up in this build" message when `google-services.json` is absent.
- Session expiry: revoking the app's session from another client made the next request return
  401 and the app returned to sign-in with "Your session has ended. Please sign in again."
- Screenshots: `docs/screenshots/mobile/` (iOS light and dark, plus `android-*`).

Known API issue: `GET /v1/notifications?unreadOnly=false` returns unread items only, because
`z.coerce.boolean()` turns the string `"false"` into `true`. The app omits the flag; the
contract should parse `'true'`/`'false'` explicitly.

Not verified:

- Real push delivery through FCM (no Firebase project/credentials here; iOS also needs the
  Firebase iOS SDK, see Push). FCM token retrieval on Android needs `google-services.json`.
- Physical devices, release/TestFlight/Play builds and signing.
- The offline banner by cutting the simulator's network (the code path is covered by the
  fetcher's network-error handling but was not exercised by hand).
