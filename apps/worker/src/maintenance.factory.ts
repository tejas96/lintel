import {
  type ApplicationStores,
  type RequestContext,
  RunRewardEvaluationCommand,
  type UnitOfWork,
} from '@lintel/application';
import {
  type DatabaseConnection,
  purgeExpiredSecurityRecords,
  RewardScheduleRepository,
} from '@lintel/database';
import { type Clock, PreconditionFailedError } from '@lintel/shared';
import type { MaintenanceDependencies, OrganizationContext } from './activities';
import type { WorkerLogger } from './observability/worker-logger';

/**
 * Builds the maintenance activity dependencies. Scheduled reward runs execute
 * the same application command as the API, recorded in the audit log under the
 * studio owner with a "scheduled" request ID.
 */
export function createMaintenanceDependencies(input: {
  database: DatabaseConnection;
  uow: UnitOfWork<ApplicationStores>;
  clock: Clock;
  logger: WorkerLogger;
  organization: OrganizationContext;
}): MaintenanceDependencies {
  const schedule = new RewardScheduleRepository(input.database.db);
  const command = new RunRewardEvaluationCommand(input.uow, input.clock);
  return {
    clock: input.clock,
    logger: input.logger,
    organization: input.organization,
    purgeSecurityRecords: (now) => purgeExpiredSecurityRecords(input.database.db, now),
    rewards: {
      activePolicies: () => schedule.activePolicies(),
      async run(policyId, periodStart) {
        const ownerId = await schedule.ownerUserId();
        if (!ownerId)
          throw new PreconditionFailedError('No active owner to record the scheduled reward run.');
        const context: RequestContext = {
          actor: {
            userId: ownerId,
            role: 'owner',
            capabilities: new Set(['rewards.manage_policies']),
          },
          sessionId: 'scheduled',
          requestId: `scheduled:rewards:${periodStart}`,
        };
        return command.execute(context, policyId, periodStart);
      },
    },
  };
}
