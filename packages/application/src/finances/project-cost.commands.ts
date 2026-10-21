import { PROJECT_COST_CATEGORIES, type ProjectCostCategory } from '@lintel/domain';
import {
  type Clock,
  calendarDateInTimeZone,
  type ErrorDetail,
  InvalidTransitionError,
  isCalendarDate,
  NotFoundError,
  ValidationFailedError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { ProjectCostRecord } from './project-cost.store';
import { requireProjectFinances } from './project-finances.access';

type CostStores = Pick<ApplicationStores, 'access' | 'costs' | 'records' | 'settings'>;

export interface RecordProjectCostInput {
  readonly entryDate: string;
  readonly category: ProjectCostCategory;
  readonly amountMinor: number;
  readonly note: string | null;
}

/** Ten thousand crore in paise: far beyond any studio project, small enough to stay exact. */
export const MAX_COST_AMOUNT_MINOR = 1_000_000_000_000;

function auditView(cost: ProjectCostRecord) {
  return {
    projectId: cost.projectId,
    entryDate: cost.entryDate,
    category: cost.category,
    amountMinor: cost.amountMinor,
    currency: cost.currency,
    note: cost.note,
  };
}

function validate(input: RecordProjectCostInput, today: string): void {
  const issues: ErrorDetail[] = [];
  if (!isCalendarDate(input.entryDate)) {
    issues.push({ field: 'entryDate', message: 'Use a real date in YYYY-MM-DD format.' });
  } else if (input.entryDate > today) {
    issues.push({ field: 'entryDate', message: 'Record costs on or before today.' });
  }
  if (!PROJECT_COST_CATEGORIES.includes(input.category)) {
    issues.push({ field: 'category', message: 'Choose a category.' });
  }
  if (
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor > MAX_COST_AMOUNT_MINOR
  ) {
    issues.push({ field: 'amountMinor', message: 'Enter an amount above zero.' });
  }
  if (issues.length > 0) throw new ValidationFailedError('Check the cost entry.', issues);
}

/**
 * The project cost ledger. Recording and voiding need finance access to the
 * project (see `requireProjectFinances`) and profitability switched on. Both
 * write an audit entry in the same transaction. No activity-feed entry is
 * written: the feed is visible to every project member, costs are not.
 */
export class ProjectCostCommands {
  constructor(
    private readonly uow: UnitOfWork<CostStores>,
    private readonly clock: Clock,
  ) {}

  async record(
    context: RequestContext,
    projectId: string,
    input: RecordProjectCostInput,
  ): Promise<ProjectCostRecord> {
    return this.uow.transaction(async (stores) => {
      const { currency } = await requireProjectFinances(
        new ProjectAccessService(stores.access),
        stores.settings,
        context.actor,
        projectId,
        'write',
      );
      const { timeZone } = await stores.settings.organization();
      validate(input, calendarDateInTimeZone(this.clock.now(), timeZone));
      const cost = await stores.costs.insert({
        projectId,
        entryDate: input.entryDate,
        category: input.category,
        amountMinor: input.amountMinor,
        currency,
        note: input.note?.trim() ? input.note.trim() : null,
        recordedByUserId: context.actor.userId,
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'project_cost.recorded',
        entityType: 'project_cost',
        entityId: cost.id,
        after: auditView(cost),
        requestId: context.requestId,
      });
      return cost;
    });
  }

  /** Voids an entry (it stays in the ledger, struck through, with the reason). */
  async void(
    context: RequestContext,
    projectId: string,
    costId: string,
    input: { readonly reason: string; readonly expectedVersion: number },
  ): Promise<ProjectCostRecord> {
    return this.uow.transaction(async (stores) => {
      await requireProjectFinances(
        new ProjectAccessService(stores.access),
        stores.settings,
        context.actor,
        projectId,
        'write',
      );
      const cost = await stores.costs.findInProject(projectId, costId);
      if (!cost) throw new NotFoundError('Cost entry');
      if (cost.voidedAt) throw new InvalidTransitionError('This cost entry is already void.');
      const voided = await stores.costs.markVoid({
        costId,
        expectedVersion: input.expectedVersion,
        voidedByUserId: context.actor.userId,
        reason: input.reason.trim(),
        at: this.clock.now(),
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'project_cost.voided',
        entityType: 'project_cost',
        entityId: costId,
        before: auditView(cost),
        after: { ...auditView(voided), voidReason: voided.voidReason },
        requestId: context.requestId,
      });
      return voided;
    });
  }
}
