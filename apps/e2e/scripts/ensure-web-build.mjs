#!/usr/bin/env node
// Next.js bakes the /api rewrite target into the build. This makes sure the
// web build proxies to the end-to-end API, and rebuilds it when it does not
// (or always, with E2E_REBUILD_WEB=1, after changing web code locally).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '../../web');
const target = process.env.API_INTERNAL_URL;
if (!target) throw new Error('API_INTERNAL_URL is required.');

function builtTarget() {
  const manifest = join(web, '.next/routes-manifest.json');
  if (!existsSync(manifest) || !existsSync(join(web, 'public/firebase-messaging-sw.js'))) {
    return null;
  }
  const routes = JSON.parse(readFileSync(manifest, 'utf8'));
  const rewrites = Array.isArray(routes.rewrites)
    ? routes.rewrites
    : [...(routes.rewrites?.beforeFiles ?? []), ...(routes.rewrites?.afterFiles ?? [])];
  return rewrites.find((rewrite) => rewrite.source === '/api/:path*')?.destination ?? null;
}

const wanted = `${target}/:path*`;
if (process.env.E2E_REBUILD_WEB !== '1' && builtTarget() === wanted) {
  console.info(`Web build already proxies /api to ${target}.`);
} else {
  console.info(`Building the web app to proxy /api to ${target}…`);
  const result = spawnSync('pnpm', ['run', 'build'], {
    cwd: web,
    env: { ...process.env, API_INTERNAL_URL: target },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
