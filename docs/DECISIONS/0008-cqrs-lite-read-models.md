# 0008 — Commands through ports, reads through read models

**Decision.** Writes go controller → application command → store ports →
repositories inside one transaction. Reads that assemble screens (lists, control
room, dashboards, work queue inputs) use SQL read models in
`packages/database/src/queries/**`, returning JSON-ready views that match the
contract. Shared views (`TaskSummary`, `ProjectSummary`, people) have exactly one
implementation.

**Consequences.** Business rules stay testable and framework-free while screens
get efficient queries. Access checks still run in application services before
read models are queried.
