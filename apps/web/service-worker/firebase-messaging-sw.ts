/// <reference lib="webworker" />
/**
 * Web push service worker (bundled by scripts/build-service-worker.mjs into
 * public/firebase-messaging-sw.js). The page registers it with the public
 * Firebase web config in the query string, so one file serves every
 * environment. Firebase shows each notification while Lintel is in the
 * background and opens its `webpush.fcmOptions.link` on click (same origin,
 * https only); while a Lintel tab is focused, the page receives the message.
 * Nothing here caches pages or intercepts requests.
 */
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope;

const FIELDS = ['apiKey', 'projectId', 'messagingSenderId', 'appId'] as const;

function configFromLocation(): Record<(typeof FIELDS)[number], string> | null {
  const params = new URL(self.location.href).searchParams;
  const entries = FIELDS.map((field) => [field, params.get(field) ?? ''] as const);
  if (entries.some(([, value]) => value.length === 0)) return null;
  return Object.fromEntries(entries) as Record<(typeof FIELDS)[number], string>;
}

const config = configFromLocation();
if (config) getMessaging(initializeApp(config));

// Take over from an older version of this worker straight away.
self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
