# 0004 — Opaque hashed sessions

**Decision.** Sessions are random 256-bit tokens; the database stores only an
HMAC-SHA-256. Web receives an HttpOnly, `SameSite=Lax`, `Secure` (production)
cookie and a readable CSRF cookie echoed in `x-lintel-csrf` on unsafe requests.
Mobile receives the token once and keeps it in the OS keychain/keystore
(expo-secure-store) and sends it as a bearer token.

**Why not JWT.** Revocation (sign-out everywhere, deactivation) must be immediate;
an opaque token checked against the database gives that without a denylist.

**Consequences.** One indexed lookup per request (last-seen updates are throttled
to every 5 minutes). Web traffic goes through the Next.js `/api` rewrite in
development and a same-site reverse proxy in production, keeping cookies first-party.
