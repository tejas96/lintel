# Architecture decision records

Short records of consequential, hard-to-reverse choices. Format: context →
decision → consequences. Status is "Accepted" unless marked otherwise.

| # | Decision |
|---|---|
| [0001](0001-modular-monolith.md) | Modular monolith with an outbox and Temporal, not microservices |
| [0002](0002-ts-rest-nestjs-11-zod-3.md) | ts-rest 3.52 contracts → NestJS 11.2 and Zod 3.25 |
| [0003](0003-single-studio-deployment.md) | One studio per deployment (single tenant) |
| [0004](0004-opaque-sessions.md) | Opaque hashed sessions: HttpOnly cookie + CSRF for web, bearer for mobile |
| [0005](0005-otp-verified-by-lintel.md) | Lintel generates and verifies OTPs; MSG91 only delivers them |
| [0006](0006-temporal-topology.md) | Temporal: CLI dev server locally, PostgreSQL-backed server in production, separate worker process |
| [0007](0007-compiled-internal-packages.md) | Internal packages compile to CommonJS + declarations |
| [0008](0008-cqrs-lite-read-models.md) | Commands through ports; reads through SQL read models |
| [0009](0009-typescript-5-9.md) | TypeScript 5.9 rather than the native TypeScript 7 compiler |
| [0010](0010-expo-managed-cng.md) | Expo SDK 58 managed workflow with continuous native generation |
