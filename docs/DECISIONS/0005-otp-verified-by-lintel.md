# 0005 — Lintel generates and verifies OTPs

**Context.** MSG91's classic API can generate and verify OTPs itself, or accept a
caller-supplied code (`otp` parameter on `POST /api/v5/otp`).

**Decision.** Lintel generates the code, stores its HMAC, and verifies locally;
MSG91 only delivers it. A development provider writes the code to the local log.

**Consequences.** Identical expiry, attempt, cooldown and enumeration rules for
every provider, testable without SMS. Resend = a new code (the previous one is
invalidated), so MSG91's retry endpoint is not used. Production refuses the
development provider and any fixed development code.
Source: https://docs.msg91.com/otp/sendotp.md
