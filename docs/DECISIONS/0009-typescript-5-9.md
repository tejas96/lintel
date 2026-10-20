# 0009 — TypeScript 5.9

**Context.** TypeScript 7.0.2 (the native Go compiler) is `latest`. NestJS CLI 11,
ts-rest's heavy type-level code and parts of the toolchain still rely on the
JavaScript compiler API and 5.x behaviour.

**Decision.** Pin TypeScript 5.9.3 via the pnpm catalog with strict settings
(`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …).

**Consequences.** Revisit when NestJS, ts-rest and Next.js document TypeScript 7 support.
