import { type Clock, ForbiddenError, NotFoundError } from '@lintel/shared';
import type { RecordStore } from '../common/record.store';
import type { RequestContext } from '../common/request-context';
import type { IdentityStore, SessionRecord } from './identity.store';

/** Sign-out and session revocation for the current person or, with permission, others. */
export class SessionManagement {
  constructor(
    private readonly store: IdentityStore,
    private readonly records: RecordStore,
    private readonly clock: Clock,
  ) {}

  async signOut(context: RequestContext): Promise<void> {
    await this.store.revokeSession(context.sessionId, 'signed_out', this.clock.now());
    await this.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'auth.signed_out',
      entityType: 'session',
      entityId: context.sessionId,
      requestId: context.requestId,
    });
  }

  listMySessions(context: RequestContext): Promise<SessionRecord[]> {
    return this.store.listActiveSessions(context.actor.userId, this.clock.now());
  }

  async revokeSession(context: RequestContext, sessionId: string): Promise<void> {
    const now = this.clock.now();
    const own = await this.store.listActiveSessions(context.actor.userId, now);
    const isOwn = own.some((session) => session.id === sessionId);
    if (!isOwn && !context.actor.capabilities.has('users.manage')) {
      throw new NotFoundError('Session');
    }
    if (!isOwn && context.actor.role !== 'owner' && (await this.belongsToOwner(sessionId, now))) {
      throw new ForbiddenError("Only the owner can sign out the owner's devices.");
    }
    await this.store.revokeSession(sessionId, 'revoked', now);
    await this.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'auth.session_revoked',
      entityType: 'session',
      entityId: sessionId,
      requestId: context.requestId,
    });
  }

  private async belongsToOwner(sessionId: string, now: Date): Promise<boolean> {
    const owner = await this.store.findSessionOwner(sessionId, now);
    return owner?.role === 'owner';
  }

  async revokeAllForUser(context: RequestContext, userId: string, reason: string): Promise<number> {
    if (userId !== context.actor.userId && !context.actor.capabilities.has('users.manage')) {
      throw new ForbiddenError();
    }
    const target = await this.store.findUserById(userId);
    if (target?.role === 'owner' && context.actor.role !== 'owner') {
      throw new ForbiddenError("Only the owner can sign out the owner's devices.");
    }
    const count = await this.store.revokeAllSessions(userId, reason, this.clock.now());
    await this.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'auth.sessions_revoked',
      entityType: 'user',
      entityId: userId,
      after: { count, reason },
      requestId: context.requestId,
    });
    return count;
  }
}
