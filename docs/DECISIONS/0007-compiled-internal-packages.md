# 0007 — Internal packages compile to CommonJS + declarations

**Decision.** Every `packages/*` builds with `tsc` (`module: NodeNext`, no
`"type": "module"` → CommonJS) to `dist/` with `.d.ts`. Turborepo builds
dependencies first.

**Why.** NestJS needs emitted decorator metadata and runs plain Node; Temporal
bundles workflows with webpack; Next.js and Metro consume JavaScript without extra
transpilation settings. Source-only packages would need a bundler for the API.

**Consequences.** Watch mode (`tsc --watch`) during development; declaration size
matters, hence named response types in contracts.
