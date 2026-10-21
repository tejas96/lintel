import { budgetAfterFeeChange, PROJECT_COST_CATEGORY_LABELS } from '@lintel/domain';
import { calendarDateInTimeZone, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { ScopeChangeRecord } from './scope-change.store';

export interface AppliedScopeMoney {
  readonly costEntryId: string | null;
  readonly budgetBeforeMinor: number | null;
  readonly budgetAfterMinor: number | null;
}

type MoneyStores = Pick<ApplicationStores, 'costs' | 'projects' | 'settings' | 'records'>;

export const NO_MONEY_APPLIED: AppliedScopeMoney = {
  costEntryId: null,
  budgetBeforeMinor: null,
  budgetAfterMinor: null,
};

/**
 * The money side of an approved scope change, in the approval's transaction:
 * its cost becomes a cost-ledger entry (dated the day of approval, linked to
 * the change, at most one per change) and its fee changes the budget. Both
 * are audited; neither reaches the activity feed, which every member reads.
 */
export async function applyScopeMoney(
  stores: MoneyStores,
  change: ScopeChangeRecord,
  approval: { readonly at: Date; readonly context: RequestContext },
): Promise<AppliedScopeMoney> {
  const { context } = approval;
  let costEntryId: string | null = null;
  if (change.costImpactMinor !== null) {
    const settings = await stores.settings.organization();
    const category = change.costCategory ?? 'other';
    const cost = await stores.costs.insert({
      projectId: change.projectId,
      entryDate: calendarDateInTimeZone(approval.at, settings.timeZone),
      category,
      amountMinor: change.costImpactMinor,
      currency: settings.currency,
      note: `Scope change "${change.title}"`,
      recordedByUserId: context.actor.userId,
      scopeChangeId: change.id,
    });
    costEntryId = cost.id;
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'project_cost.recorded',
      entityType: 'project_cost',
      entityId: cost.id,
      after: {
        projectId: cost.projectId,
        entryDate: cost.entryDate,
        category: PROJECT_COST_CATEGORY_LABELS[category],
        amountMinor: cost.amountMinor,
        currency: cost.currency,
        scopeChangeId: change.id,
      },
      requestId: context.requestId,
    });
  }
  if (change.feeImpactMinor === null) return { ...NO_MONEY_APPLIED, costEntryId };
  const project = await stores.projects.findById(change.projectId);
  const before = project?.budgetMinor ?? null;
  const after = budgetAfterFeeChange(before, change.feeImpactMinor);
  if (project && after !== before) {
    const updated = await stores.projects.update(project.id, project.version, {
      budgetMinor: after,
    });
    if (!updated) throw new StaleVersionError('This project');
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'project.budget_changed',
      entityType: 'project',
      entityId: project.id,
      before: { budgetMinor: before },
      after: {
        budgetMinor: after,
        scopeChangeId: change.id,
        feeImpactMinor: change.feeImpactMinor,
      },
      requestId: context.requestId,
    });
  }
  return { costEntryId, budgetBeforeMinor: before, budgetAfterMinor: after };
}
