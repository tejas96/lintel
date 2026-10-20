import type { MaintenanceDependencies } from '../activities';
import type { ActivityDependencies } from '../activities/activity-dependencies';

/** Maintenance dependencies that do nothing, for tests that exercise other activities. */
export function noopMaintenance(deps: ActivityDependencies): MaintenanceDependencies {
  return {
    clock: deps.clock,
    logger: deps.logger,
    organization: deps.organization,
    purgeSecurityRecords: async () => ({
      rateLimitCounters: 0,
      otpChallenges: 0,
      sessions: 0,
      idempotencyRecords: 0,
    }),
    rewards: { activePolicies: async () => [], run: async () => ({ evaluated: 0, eligible: 0 }) },
  };
}

/** Arguments for `createActivities` with no-op maintenance dependencies. */
export function withNoopMaintenance(
  deps: ActivityDependencies,
): [ActivityDependencies, MaintenanceDependencies] {
  return [deps, noopMaintenance(deps)];
}
