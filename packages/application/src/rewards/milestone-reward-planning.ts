import {
  type DocumentFolder,
  MAX_SHARED_REWARD_RECIPIENTS,
  type RewardScope,
} from '@lintel/domain';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import type { MilestoneRewardTarget } from './milestone-reward.store';

export type PlanStores = Pick<
  ApplicationStores,
  'access' | 'milestoneRewards' | 'settings' | 'records' | 'notifications'
>;

export interface MilestoneRewardRequest {
  readonly scope: RewardScope;
  readonly recipientUserIds: readonly string[];
  readonly amountMinor: number;
  readonly requiredDocumentFolders: readonly DocumentFolder[];
  readonly note: string | null;
  /** The plan's version when changing or re-attaching one; null for a first attach. */
  readonly version: number | null;
}

/** Attaching, changing and withdrawing milestone rewards needs `rewards.manage_policies`. */
export function requirePlanner(context: RequestContext): void {
  if (!context.actor.capabilities.has('rewards.manage_policies')) throw new ForbiddenError();
}

/** One person for an individual reward; 2 to 20 distinct people for a shared one. */
export function distinctRecipients(request: MilestoneRewardRequest): string[] {
  const people = [...new Set(request.recipientUserIds)];
  if (request.scope === 'individual' && people.length !== 1) {
    throw new ValidationFailedError('An individual reward goes to exactly one person.', [
      { field: 'recipientUserIds', message: 'Choose one person.' },
    ]);
  }
  if (
    request.scope === 'team' &&
    (people.length < 2 || people.length > MAX_SHARED_REWARD_RECIPIENTS)
  ) {
    throw new ValidationFailedError('A shared reward goes to a group of people.', [
      { field: 'recipientUserIds', message: `Choose 2 to ${MAX_SHARED_REWARD_RECIPIENTS} people.` },
    ]);
  }
  return people;
}

/** The milestone, when the planner may see its project (404 otherwise). */
export async function visibleRewardTarget(
  stores: PlanStores,
  context: RequestContext,
  milestoneId: string,
): Promise<MilestoneRewardTarget> {
  const target = await stores.milestoneRewards.findTarget(milestoneId);
  if (!target) throw new NotFoundError('Milestone');
  await new ProjectAccessService(stores.access).requireView(
    context.actor,
    target.projectId,
    'Milestone',
  );
  return target;
}

/** The plan as written to the audit log (amounts included: audit is restricted). */
export function auditablePlan(
  plan: { readonly scope: string; readonly amountMinor: number; readonly note: string | null },
  people: readonly string[],
  folders: readonly string[],
) {
  return {
    scope: plan.scope,
    amountMinor: plan.amountMinor,
    recipients: [...people],
    requiredDocumentFolders: [...folders],
    note: plan.note,
  };
}
