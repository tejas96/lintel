#!/usr/bin/env node
// Fails when a handwritten source file is longer than the agreed limit.
// Generated files are excluded here and listed in docs/ARCHITECTURE.md.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAX_LINES = 250;
const SOURCE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|css)$/;
const EXCLUDED = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)\.next\//,
  /(^|\/)migrations\//,
  /next-env\.d\.ts$/,
  /expo-env\.d\.ts$/,
  /(^|\/)ios\//,
  /(^|\/)android\//,
];

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(
    (file) => SOURCE_EXTENSIONS.test(file) && !EXCLUDED.some((pattern) => pattern.test(file)),
  );

const oversized = [];
for (const file of tracked) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted but still listed
  }
  const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
  if (lines > MAX_LINES) oversized.push({ file, lines });
}

if (oversized.length > 0) {
  console.error(`Files longer than ${MAX_LINES} lines:`);
  for (const { file, lines } of oversized.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${String(lines).padStart(5)}  ${file}`);
  }
  process.exit(1);
}
console.info(`File size check passed: ${tracked.length} source files, all ≤ ${MAX_LINES} lines.`);
