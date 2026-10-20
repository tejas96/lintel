import type { Actor, Capability } from '@lintel/domain';
import type { Clock } from '@lintel/shared';
import type { SecretHasher } from '../ports/security.port';
import type { IdentityStore, SessionRecord, UserRecord } from './identity.store';

export interface AuthenticatedSession {
  readonly actor: Actor;
  readonly session: SessionRecord;
  readonly user: UserRecord;
}

/** How often `last_seen_at` is refreshed, to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 5 * 60_000;

/**
 * Resolves a bearer or cookie token to an actor. Revoked, expired and
 * deactivated sessions all resolve to null.
 */
export class AuthenticateSessionQuery {
  constructor(
    private readonly store: IdentityStore,
    private readonly hasher: SecretHasher,
    private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<AuthenticatedSession | null> {
    if (token.length < 32 || token.length > 200) return null;
    const now = this.clock.now();
    const session = await this.store.findActiveSessionByTokenHash(this.hasher.hash(token), now);
    if (!session) return null;
    const user = await this.store.findUserById(session.userId);
    if (user?.status !== 'active') return null;
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.store.touchSession(session.id, now);
    }
    const capabilities: ReadonlySet<Capability> = new Set(
      await this.store.capabilitiesForRole(user.role),
    );
    return { actor: { userId: user.id, role: user.role, capabilities }, session, user };
  }
}
