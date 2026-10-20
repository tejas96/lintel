#!/usr/bin/env node
// Enforces the dependency rules in docs/ARCHITECTURE.md by checking each
// workspace package's declared dependencies and its import statements.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Which @lintel packages each package may depend on. */
const ALLOWED = {
  '@lintel/shared': [],
  '@lintel/domain': ['@lintel/shared'],
  '@lintel/configuration': ['@lintel/shared'],
  '@lintel/api-contracts': ['@lintel/shared', '@lintel/domain'],
  '@lintel/application': ['@lintel/shared', '@lintel/domain'],
  '@lintel/database': ['@lintel/shared', '@lintel/domain', '@lintel/application'],
  '@lintel/integrations': ['@lintel/shared', '@lintel/domain', '@lintel/application'],
  '@lintel/design-system': ['@lintel/shared', '@lintel/domain'],
};

/** Third-party packages that must never appear in pure packages. */
const FORBIDDEN_EXTERNALS = {
  '@lintel/shared': [
    /^@nestjs\//,
    /^next/,
    /^react/,
    /^drizzle/,
    /^pg$/,
    /^@aws-sdk/,
    /^firebase/,
    /^@temporalio/,
  ],
  '@lintel/domain': [
    /^@nestjs\//,
    /^next/,
    /^react/,
    /^drizzle/,
    /^pg$/,
    /^@aws-sdk/,
    /^firebase/,
    /^@temporalio/,
    /^zod/,
  ],
  '@lintel/application': [
    /^@nestjs\//,
    /^next/,
    /^react/,
    /^drizzle/,
    /^pg$/,
    /^@aws-sdk/,
    /^firebase/,
    /^@temporalio/,
  ],
  '@lintel/api-contracts': [/^@nestjs\//, /^next/, /^drizzle/, /^pg$/, /^@lintel\/database/],
};

const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

const problems = [];
for (const folder of readdirSync('packages')) {
  const manifestPath = join('packages', folder, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    continue;
  }
  const allowed = ALLOWED[manifest.name];
  if (!allowed) {
    problems.push(`${manifest.name}: not listed in check-boundaries.mjs`);
    continue;
  }
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies });
  for (const dependency of declared.filter((name) => name.startsWith('@lintel/'))) {
    if (!allowed.includes(dependency))
      problems.push(`${manifest.name} must not depend on ${dependency}`);
  }
  const forbidden = FORBIDDEN_EXTERNALS[manifest.name] ?? [];
  for (const file of sourceFiles(join('packages', folder, 'src'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (specifier.startsWith('@lintel/') && !allowed.some((name) => specifier.startsWith(name))) {
        problems.push(`${file} imports ${specifier}`);
      }
      if (forbidden.some((pattern) => pattern.test(specifier))) {
        problems.push(`${file} imports forbidden package ${specifier}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('Dependency boundary violations:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.info('Dependency boundary check passed.');
