# AI — Phase 2 (disabled in Phase 1)

## Phase 1 state

- `AI_FEATURES_ENABLED=false` by default; configuration **refuses** `true` during
  Phase 1 (`packages/configuration/src/environment.schema.ts`).
- `FeatureFlags.aiFeaturesEnabled` is hard-wired to `false` in the API.
- The only `AiAssistant` implementation is `DisabledAiAssistant`
  (`packages/application/src/ai/`), which never creates a model client and always
  throws `FEATURE_DISABLED` (HTTP 503).
- `GET /v1/ai/status` returns `{ enabled: false }`; `currentUser.aiFeaturesEnabled`
  is the literal `false`, so the apps render no AI entry points — there are no
  dead "Ask AI" buttons.
- No model credentials exist in any environment file, web bundle or mobile bundle.

Phase 1 remains fully functional without AI.

## Planned capabilities

1. Natural-language questions about project status ("What is holding up Saska?").
2. Delay explanations built from schedule changes, blockers and dependencies.
3. Delivery-risk summaries for the command center.
4. Workload and reassignment suggestions using the capacity model.
5. Suggested prioritisation alongside the deterministic queue (never replacing it silently).
6. Natural-language reports for owners and clients.
7. Template recommendations and draft project plans from a brief.
8. Recurring bottleneck detection (stages, reviewers, suppliers).
9. Conversational navigation ("open the overdue tasks in my projects").

## Integration boundary

```
Web/mobile ──▶ /v1/ai/* (new contract) ──▶ AiAssistant port (application)
                                              │
                         ┌────────────────────┴──────────────────────┐
                 Retrieval tools = existing read models     Suggested actions = names of
                 called with the actor's RequestContext      existing application commands
                         │                                            │
                 same ProjectAccessService checks          executed only after the person
                                                            confirms, through the normal API
```

- **Deterministic rules stay authoritative.** Priority scores, health, leave policy
  and reward eligibility are computed by the domain; AI may explain or suggest,
  and its output is labelled as a suggestion.
- **Tools, not tables.** The model never gets SQL or a database role. It calls
  typed tools that wrap existing read models and commands, each executed with the
  signed-in person's `RequestContext`, so permission boundaries are identical.
- **No autonomous critical actions.** AI must never by itself approve leave,
  change compensation, grant or deduct rewards, change committed deadlines,
  reassign critical tasks, modify scope, change permissions or publish workflow
  changes. These appear only as `AiSuggestedAction` with `requiresConfirmation: true`.

## Activation requirements

1. Phase 2 decision recorded as an ADR; this document updated.
2. Provider chosen (`AI_PROVIDER`), data-processing agreement reviewed, data
   residency checked (client and employee data).
3. Server-side credentials only (`AI_API_KEY` in the secrets store); never sent to clients.
4. Configuration change: remove the Phase 1 refusal, add provider validation.
5. Per-studio switch plus per-capability allow-list (e.g. `ai.ask`, `ai.reports`).
6. Cost controls: per-person rate limit, monthly budget alarm, response caching.
7. Evaluation set of real (anonymised) studio questions with expected answers,
   run before every model or prompt change.

## Audit strategy

Every AI interaction writes an `audit_log` row: actor, capability, question (or a
hash when flagged sensitive), tools called with record IDs, model and version,
token counts, suggested actions, and whether the person accepted each one.
Accepted actions additionally produce the normal command audit records, linked by
request ID.
