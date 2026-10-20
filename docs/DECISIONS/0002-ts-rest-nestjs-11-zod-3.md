# 0002 — ts-rest 3.52 → NestJS 11.2 and Zod 3.25

**Context.** The brief requires ts-rest for shared contracts. On 2026-10-21 the
latest stable ts-rest is 3.52.1 (March 2025); `@ts-rest/nest` peers NestJS ^9–^11
and core/open-api peer Zod ^3. NestJS 12.2 and Zod 4.6 are current. A 3.53 RC
(June 2025) adds Standard Schema but is unreleased; v4 is a draft PR.

**Decision.** Use ts-rest 3.52.1 stable, NestJS 11.2.7 (the maintained `legacy`
line) and Zod 3.25.76 so every peer range is satisfied. Assemble the router per
app (`initContract().router(apiRouterDefinition, apiContractOptions)`) because a
single exported router exceeds TypeScript's declaration-size limit; response
schemas are exported with named types to keep declarations small.

**Consequences.** A known-good, peer-compatible stack. Risk: ts-rest is in
maintenance mode. Mitigation: contracts are plain Zod in one package and
controllers are thin, so moving to ts-rest v4 (Zod 4) or another contract library
is contained. Known gotcha: never inject `@Res()` in a multi-route handler.
Sources: https://ts-rest.com/server/nest, https://github.com/ts-rest/ts-rest/pull/863
