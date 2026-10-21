import { validateSecondApprovalThreshold } from '@lintel/domain';
import { ValidationFailedError } from '@lintel/shared';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';

/** Studio-wide leave rules. Stored with the organisation settings. */
export interface LeaveRules {
  /** Requests longer than this many half-days need a second approval. */
  readonly secondApprovalAboveHalfDays: number;
}

type LeaveRuleStores = Pick<ApplicationStores, 'settings' | 'records'>;

export function leaveRulesOf(settings: { leaveSecondApprovalAboveHalfDays: number }): LeaveRules {
  return { secondApprovalAboveHalfDays: settings.leaveSecondApprovalAboveHalfDays };
}

/** Changes the second-approval threshold (`leave.manage_policies`). Audited. */
export class UpdateLeaveRulesCommand {
  constructor(private readonly uow: UnitOfWork<LeaveRuleStores>) {}

  async execute(context: RequestContext, rules: LeaveRules): Promise<LeaveRules> {
    requireCapability(context, 'leave.manage_policies');
    const problem = validateSecondApprovalThreshold(rules.secondApprovalAboveHalfDays);
    if (problem) {
      throw new ValidationFailedError(problem, [
        { field: 'secondApprovalAboveHalfDays', message: problem },
      ]);
    }
    return this.uow.transaction(async (stores) => {
      const before = await stores.settings.organization();
      if (before.leaveSecondApprovalAboveHalfDays === rules.secondApprovalAboveHalfDays) {
        return leaveRulesOf(before);
      }
      const after = await stores.settings.updateOrganization({
        ...before,
        leaveSecondApprovalAboveHalfDays: rules.secondApprovalAboveHalfDays,
      });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'leave_rules.updated',
        entityType: 'organization',
        entityId: null,
        before: { ...leaveRulesOf(before) },
        after: { ...leaveRulesOf(after) },
        requestId: context.requestId,
      });
      return leaveRulesOf(after);
    });
  }
}
