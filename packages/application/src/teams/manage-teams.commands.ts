import {
  normaliseTeamDefinition,
  type TeamDefinition,
  teamArchiveBlocker,
  teamNameKey,
  validateTeamDefinition,
} from '@lintel/domain';
import {
  type Clock,
  ConflictError,
  definedOnly,
  NotFoundError,
  type Patch,
  PreconditionFailedError,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { TeamChanges, TeamRecord } from './team.store';

type TeamStores = Pick<ApplicationStores, 'teams' | 'people' | 'records'>;

const FIELDS: readonly (keyof TeamDefinition)[] = ['name', 'description', 'leadUserId'];

function definitionOf(team: TeamRecord): TeamDefinition {
  return { name: team.name, description: team.description, leadUserId: team.leadUserId };
}

async function assertValid(
  stores: TeamStores,
  definition: TeamDefinition,
  others: readonly TeamRecord[],
): Promise<void> {
  const problems = validateTeamDefinition(definition);
  if (problems.length > 0) throw new ValidationFailedError('Check the team.', problems);
  const key = teamNameKey(definition.name);
  // Archived teams keep their name, so bringing one back never collides.
  if (others.some((other) => teamNameKey(other.name) === key)) {
    throw new ConflictError('Another team already has this name.', [
      { field: 'name', message: 'Choose a name no other team uses, archived ones included.' },
    ]);
  }
  if (definition.leadUserId) {
    const lead = await stores.people.findById(definition.leadUserId);
    if (!lead || lead.status === 'deactivated') {
      throw new ValidationFailedError('Choose someone in the studio to lead the team.', [
        { field: 'leadUserId', message: 'Choose an active person.' },
      ]);
    }
  }
}

/**
 * Teams: create, rename, set the lead, archive and bring back (`users.manage`).
 * Archiving waits until nobody active is on the team (see `teamArchiveBlocker`).
 */
export class ManageTeamsCommands {
  constructor(
    private readonly uow: UnitOfWork<TeamStores>,
    private readonly clock: Clock,
  ) {}

  async create(context: RequestContext, definition: TeamDefinition): Promise<TeamRecord> {
    requireCapability(context, 'users.manage');
    const clean = normaliseTeamDefinition(definition);
    return this.uow.transaction(async (stores) => {
      await assertValid(stores, clean, await stores.teams.list());
      const created = await stores.teams.create(clean);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'team.created',
        entityType: 'team',
        entityId: created.id,
        after: { ...definitionOf(created) },
        requestId: context.requestId,
      });
      return created;
    });
  }

  async update(
    context: RequestContext,
    teamId: string,
    version: number,
    changes: Patch<TeamDefinition>,
  ): Promise<TeamRecord> {
    requireCapability(context, 'users.manage');
    return this.uow.transaction(async (stores) => {
      const before = await this.load(stores, teamId, version);
      const merged = normaliseTeamDefinition({
        ...definitionOf(before),
        ...definedOnly(changes),
      });
      const changed = FIELDS.filter((field) => merged[field] !== before[field]);
      if (changed.length === 0) return before;
      const others = (await stores.teams.list()).filter((team) => team.id !== before.id);
      await assertValid(stores, merged, others);
      const after = Object.fromEntries(changed.map((field) => [field, merged[field]]));
      const saved = await this.write(stores, before, after);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'team.updated',
        entityType: 'team',
        entityId: before.id,
        before: Object.fromEntries(changed.map((field) => [field, before[field]])),
        after,
        requestId: context.requestId,
      });
      return saved;
    });
  }

  /** Archive (false) or bring back (true). Archiving needs the team to be empty. */
  async setActive(
    context: RequestContext,
    teamId: string,
    version: number,
    active: boolean,
  ): Promise<TeamRecord> {
    requireCapability(context, 'users.manage');
    return this.uow.transaction(async (stores) => {
      const before = await this.load(stores, teamId, version);
      if ((before.archivedAt === null) === active) return before;
      if (!active) {
        const blocker = teamArchiveBlocker(await stores.teams.activeMemberCount(before.id));
        if (blocker) throw new PreconditionFailedError(blocker);
      }
      const archivedAt = active ? null : this.clock.now();
      const after = await this.write(stores, before, { archivedAt });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: active ? 'team.restored' : 'team.archived',
        entityType: 'team',
        entityId: before.id,
        before: { archivedAt: before.archivedAt?.toISOString() ?? null },
        after: { archivedAt: archivedAt?.toISOString() ?? null },
        requestId: context.requestId,
      });
      return after;
    });
  }

  private async load(stores: TeamStores, teamId: string, version: number) {
    const before = await stores.teams.find(teamId);
    if (!before) throw new NotFoundError('Team');
    if (before.version !== version) throw new StaleVersionError('This team');
    return before;
  }

  private async write(stores: TeamStores, before: TeamRecord, changes: TeamChanges) {
    const after = await stores.teams.update(before.id, before.version, changes);
    if (!after) throw new StaleVersionError('This team');
    return after;
  }
}
