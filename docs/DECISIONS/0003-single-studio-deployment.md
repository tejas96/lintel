# 0003 — One studio per deployment

**Context.** The platform serves one firm. Multi-tenancy adds a tenant column to
every table and a tenant filter to every query — a large IDOR surface.

**Decision.** Single tenant. `organization_settings` has exactly one row
(enforced by a CHECK constraint).

**Consequences.** Simpler queries and authorisation. Serving several studios means
one deployment (and database) per studio, or a future migration adding tenant IDs.
