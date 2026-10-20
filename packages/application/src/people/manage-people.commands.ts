import type { Capability } from '@lintel/domain';
import {
  type Clock,
  ConflictError,
  definedOnly,
  ForbiddenError,
  maskPhoneNumber,
  NotFoundError,
  type Patch,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { PersonInput, PersonRecord } from './people.store';

/**
 * Rules for editing someone. Returns whether the sign-in phone number changes:
 * that is an account takeover risk, so administrators' numbers are owner-only
 * and every change signs the person out everywhere.
 */
function guardPersonUpdate(
  context: RequestContext,
  before: PersonRecord,
  changes: Patch<PersonInput>,
): boolean {
  const actor = context.actor;
  if (before.role === 'owner' && actor.role !== 'owner') {
    throw new ForbiddenError('Only the owner can change the owner account.');
  }
  if (changes.reportsToUserId === before.id) {
    throw new ValidationFailedError('A person cannot report to themselves.');
  }
  const phoneChanges = changes.phoneE164 !== undefined && changes.phoneE164 !== before.phoneE164;
  const editsAnotherAdministrator = before.role === 'administrator' && before.id !== actor.userId;
  if (phoneChanges && editsAnotherAdministrator && actor.role !== 'owner') {
    throw new ForbiddenError("Only the owner can change an administrator's phone number.");
  }
  return phoneChanges;
}

function auditSnapshot(person: PersonRecord, includePhone: boolean): Record<string, unknown> {
  return {
    role: person.role,
    teamId: person.teamId,
    capacityPercent: person.capacityPercent,
    ...(includePhone ? { phone: maskPhoneNumber(person.phoneE164) } : {}),
  };
}

function requireCapability(context: RequestContext, capability: Capability): void {
  if (!context.actor.capabilities.has(capability)) throw new ForbiddenError();
}

/** Administration of studio members: add, edit, deactivate and reactivate. */
export class ManagePeopleCommands {
  constructor(
    private readonly uow: UnitOfWork<ApplicationStores>,
    private readonly clock: Clock,
  ) {}

  async create(context: RequestContext, input: PersonInput): Promise<PersonRecord> {
    requireCapability(context, 'users.manage');
    this.guardOwnerRole(context, input.role);
    return this.uow.transaction(async (stores) => {
      await this.validate(stores, input, null);
      const person = await stores.people.create(input);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'people.created',
        entityType: 'user',
        entityId: person.id,
        after: { role: person.role, teamId: person.teamId },
        requestId: context.requestId,
      });
      return person;
    });
  }

  async update(
    context: RequestContext,
    userId: string,
    expectedVersion: number,
    changes: Patch<PersonInput>,
  ): Promise<PersonRecord> {
    requireCapability(context, 'users.manage');
    if (changes.role) this.guardOwnerRole(context, changes.role);
    return this.uow.transaction(async (stores) => {
      const before = await stores.people.findById(userId);
      if (!before) throw new NotFoundError('Person');
      const phoneChanges = guardPersonUpdate(context, before, changes);
      await this.validate(stores, { ...before, ...definedOnly(changes) }, userId);
      const after = await stores.people.update(userId, expectedVersion, changes);
      if (!after) throw new StaleVersionError('This person');
      if (phoneChanges) {
        await stores.identity.revokeAllSessions(userId, 'phone_number_changed', this.clock.now());
      }
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'people.updated',
        entityType: 'user',
        entityId: userId,
        before: auditSnapshot(before, phoneChanges),
        after: {
          ...auditSnapshot(after, phoneChanges),
          ...(phoneChanges ? { sessionsRevoked: true } : {}),
        },
        requestId: context.requestId,
      });
      return after;
    });
  }

  async setActive(
    context: RequestContext,
    userId: string,
    expectedVersion: number,
    active: boolean,
    reason: string | null,
  ): Promise<PersonRecord> {
    requireCapability(context, 'users.manage');
    if (userId === context.actor.userId)
      throw new ValidationFailedError('You cannot deactivate yourself.');
    const now = this.clock.now();
    return this.uow.transaction(async (stores) => {
      const before = await stores.people.findById(userId);
      if (!before) throw new NotFoundError('Person');
      if (before.role === 'owner')
        throw new ForbiddenError('The owner account cannot be deactivated.');
      const after = await stores.people.setStatus(
        userId,
        expectedVersion,
        active ? 'active' : 'deactivated',
        now,
      );
      if (!after) throw new StaleVersionError('This person');
      if (!active) await stores.identity.revokeAllSessions(userId, 'account_deactivated', now);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: active ? 'people.reactivated' : 'people.deactivated',
        entityType: 'user',
        entityId: userId,
        after: { reason },
        requestId: context.requestId,
      });
      return after;
    });
  }

  async createTeam(
    context: RequestContext,
    name: string,
    description: string | null,
  ): Promise<{ id: string }> {
    requireCapability(context, 'users.manage');
    return this.uow.transaction(async (stores) => {
      if (await stores.people.teamNameInUse(name))
        throw new ConflictError('A team with this name already exists.');
      return stores.people.createTeam(name, description);
    });
  }

  private guardOwnerRole(context: RequestContext, role: string): void {
    if (role === 'owner' && context.actor.role !== 'owner') {
      throw new ForbiddenError('Only the owner can grant the owner role.');
    }
  }

  private async validate(
    stores: ApplicationStores,
    input: PersonInput,
    userId: string | null,
  ): Promise<void> {
    if (await stores.people.phoneInUse(input.phoneE164, userId)) {
      throw new ConflictError('Someone already uses this phone number.', [
        { field: 'nationalNumber', message: 'This number belongs to another person.' },
      ]);
    }
    if (input.teamId && !(await stores.people.teamExists(input.teamId))) {
      throw new ValidationFailedError('That team does not exist.', [
        { field: 'teamId', message: 'Unknown team.' },
      ]);
    }
    if (input.reportsToUserId && !(await stores.people.findById(input.reportsToUserId))) {
      throw new ValidationFailedError('That manager does not exist.', [
        { field: 'reportsToUserId', message: 'Unknown person.' },
      ]);
    }
  }
}
