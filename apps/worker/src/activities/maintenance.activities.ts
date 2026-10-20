import type { HousekeepingResult } from '@lintel/database';
import type { Clock } from '@lintel/shared';
import type { WorkerLogger } from '../observability/worker-logger';
import type { OrganizationContext } from './organization-context';
import { closedPeriodStart } from './reward-periods';

/** Scheduled reward evaluation, implemented with the application's RunRewardEvaluationCommand. */
export interface RewardScheduleRunner {
  activePolicies(): Promise<{ id: string; period: 'monthly' | 'quarterly' }[]>;
  run(policyId: string, periodStart: string): Promise<{ evaluated: number; eligible: number }>;
}

export interface MaintenanceDependencies {
  readonly clock: Clock;
  readonly logger: WorkerLogger;
  readonly organization: OrganizationContext;
  readonly purgeSecurityRecords: (now: Date) => Promise<HousekeepingResult>;
  readonly rewards: RewardScheduleRunner;
}

export interface PeriodicRewardOutcome {
  readonly policiesRun: number;
  readonly evaluated: number;
  readonly eligible: number;
  readonly failed: number;
}

/** Housekeeping and periodic jobs. Both are idempotent and safe to retry. */
export function createMaintenanceActivities(deps: MaintenanceDependencies) {
  return {
    async purgeSecurityRecords(): Promise<HousekeepingResult> {
      const result = await deps.purgeSecurityRecords(deps.clock.now());
      deps.logger.info('Security records purged', { ...result });
      return result;
    },

    async runPeriodicRewardEvaluations(): Promise<PeriodicRewardOutcome> {
      const today = await deps.organization.today();
      let outcome: PeriodicRewardOutcome = { policiesRun: 0, evaluated: 0, eligible: 0, failed: 0 };
      for (const policy of await deps.rewards.activePolicies()) {
        const periodStart = closedPeriodStart(policy.period, today);
        if (!periodStart) continue;
        try {
          const result = await deps.rewards.run(policy.id, periodStart);
          outcome = {
            ...outcome,
            policiesRun: outcome.policiesRun + 1,
            evaluated: outcome.evaluated + result.evaluated,
            eligible: outcome.eligible + result.eligible,
          };
        } catch (error) {
          outcome = { ...outcome, failed: outcome.failed + 1 };
          deps.logger.error('Scheduled reward evaluation failed', {
            policyId: policy.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      deps.logger.info('Periodic reward evaluations finished', { ...outcome });
      return outcome;
    },
  };
}
