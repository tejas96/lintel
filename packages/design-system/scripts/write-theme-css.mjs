#!/usr/bin/env node
// Writes dist/theme.css from the compiled tokens, so CSS never hand-copies a token value.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { buildThemeCss } = require(join(packageRoot, 'dist/theme-css/build-theme-css.js'));

const target = join(packageRoot, 'dist/theme.css');
writeFileSync(target, buildThemeCss());
console.info(`Wrote ${target}`);
