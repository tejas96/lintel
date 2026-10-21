#!/usr/bin/env node
// Bundles the web push service worker into public/ (git-ignored). The worker
// holds no configuration: the page passes the public Firebase web config in
// the registration URL, so the same file works with or without Firebase.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(root, 'service-worker/firebase-messaging-sw.ts')],
  outfile: join(root, 'public/firebase-messaging-sw.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  legalComments: 'none',
  logLevel: 'warning',
});
