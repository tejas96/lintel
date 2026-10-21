import {
  type LeaveTypeDefinition,
  leaveTypeCodeFor,
  validateLeaveTypeDefinition,
} from '@lintel/domain';
import {
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
import type { LeaveTypeAdminRecord, LeaveTypeChanges } from './leave-type.store';

type LeaveTypeStores = Pick<ApplicationStores, 'leaveTypes' | 'records'>;

export interface LeaveTypeUpdateInput {
  readonly version: number;
  readonly changes: Patch<LeaveTypeDefinition>;
}

const FIELDS: readonly (keyof LeaveTypeDefinition)[] = [
  'name',
  'description',
  'requiresReason',
  'allowsHalfDay',
  'minimumNoticeDays',
  'annualAllowanceHalfDays',
  'colorIndex',
];

function definitionOf(record: LeaveTypeAdminRecord): LeaveTypeDefinition {
  return {
    name: record.name,
    description: record.description,
    requiresReason: record.requiresReason,
    allowsHalfDay: record.allowsHalfDay,
    minimumNoticeDays: record.minimumNoticeDays,
    annualAllowanceHalfDays: record.annualAllowanceHalfDays,
    colorIndex: record.colorIndex,
  };
}

function normalise(definition: LeaveTypeDefinition): LeaveTypeDefinition {
  const description = definition.description?.trim() ?? '';
  return {
    ...definition,
    name: definition.name.trim(),
    description: description === '' ? null : description,
  };
}

function assertValid(definition: LeaveTypeDefinition, others: readonly LeaveTypeAdminRecord[]) {
  const problems = validateLeaveTypeDefinition(definition);
  if (problems.length > 0) throw new ValidationFailedError('Check the leave type.', problems);
  const name = definition.name.toLocaleLowerCase();
  if (others.some((other) => other.name.toLocaleLowerCase() === name)) {
    throw new ConflictError('Another leave type already has this name.', [
      { field: 'name', message: 'Choose a name no other leave type uses.' },
    ]);
  }
}

/**
 * Leave types: create, edit, retire and bring back (`leave.manage_policies`).
 * Retiring keeps existing requests intact; the type just cannot be chosen again.
 */
export class ManageLeaveTypesCommands {
  constructor(private readonly uow: UnitOfWork<LeaveTypeStores>) {}

  async create(
    context: RequestContext,
    definition: LeaveTypeDefinition,
  ): Promise<LeaveTypeAdminRecord> {
    requireCapability(context, 'leave.manage_policies');
    const clean = normalise(definition);
    return this.uow.transaction(async (stores) => {
      const existing = await stores.leaveTypes.list();
      assertValid(clean, existing);
      const code = leaveTypeCodeFor(clean.name, new Set(existing.map((type) => type.code)));
      const created = await stores.leaveTypes.create({ ...clean, code });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'leave_type.created',
        entityType: 'leave_type',
        entityId: created.id,
        after: { code, ...definitionOf(created) },
        requestId: context.requestId,
      });
      return created;
    });
  }

  async update(
    context: RequestContext,
    leaveTypeId: string,
    input: LeaveTypeUpdateInput,
  ): Promise<LeaveTypeAdminRecord> {
    requireCapability(context, 'leave.manage_policies');
    return this.uow.transaction(async (stores) => {
      const before = await this.load(stores, leaveTypeId, input.version);
      const merged = normalise({ ...definitionOf(before), ...definedOnly(input.changes) });
      const others = (await stores.leaveTypes.list()).filter((type) => type.id !== before.id);
      assertValid(merged, others);
      const changed = FIELDS.filter((field) => merged[field] !== before[field]);
      if (changed.length === 0) return before;
      const changes = Object.fromEntries(changed.map((field) => [field, merged[field]]));
      const after = await this.write(stores, before, changes);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'leave_type.updated',
        entityType: 'leave_type',
        entityId: before.id,
        before: Object.fromEntries(changed.map((field) => [field, before[field]])),
        after: changes,
        requestId: context.requestId,
      });
      return after;
    });
  }

  /** Retire (false) or bring back (true). At least one type always stays active. */
  async setActive(
    context: RequestContext,
    leaveTypeId: string,
    version: number,
    active: boolean,
  ): Promise<LeaveTypeAdminRecord> {
    requireCapability(context, 'leave.manage_policies');
    return this.uow.transaction(async (stores) => {
      const before = await this.load(stores, leaveTypeId, version);
      if (before.isActive === active) return before;
      if (!active) {
        const activeCount = (await stores.leaveTypes.list()).filter((type) => type.isActive).length;
        if (activeCount <= 1) {
          throw new PreconditionFailedError(
            'Keep at least one leave type active, so people can still ask for leave.',
          );
        }
      }
      const after = await this.write(stores, before, { isActive: active });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: active ? 'leave_type.reactivated' : 'leave_type.retired',
        entityType: 'leave_type',
        entityId: before.id,
        before: { isActive: before.isActive },
        after: { isActive: active },
        requestId: context.requestId,
      });
      return after;
    });
  }

  private async load(stores: LeaveTypeStores, leaveTypeId: string, version: number) {
    const before = await stores.leaveTypes.find(leaveTypeId);
    if (!before) throw new NotFoundError('Leave type');
    if (before.version !== version) throw new StaleVersionError('This leave type');
    return before;
  }

  private async write(
    stores: LeaveTypeStores,
    before: LeaveTypeAdminRecord,
    changes: LeaveTypeChanges,
  ): Promise<LeaveTypeAdminRecord> {
    const after = await stores.leaveTypes.update(before.id, before.version, changes);
    if (!after) throw new StaleVersionError('This leave type');
    return after;
  }
}
