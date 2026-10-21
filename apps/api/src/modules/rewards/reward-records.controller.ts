import {
  DecideMilestoneRewardCommand,
  PlanMilestoneRewardCommand,
  ProjectAccessService,
  RaiseRewardChallengeCommand,
  type RequestContext,
  ResolveRewardChallengeCommand,
  WithdrawMilestoneRewardCommand,
} from '@lintel/application';
import {
  type DatabaseConnection,
  findMilestoneRewardPlan,
  listProjectMilestoneRewards,
  queryMilestoneRewardShares,
  queryRewardChallenges,
} from '@lintel/database';
import { ForbiddenError } from '@lintel/shared';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found, pageOf, requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const routes = apiContract.rewardRecords;

/**
 * Milestone rewards and challenges. Writes go through the application
 * commands (capabilities, versions, audit, notices); reads use read models
 * that hide amounts from everyone but the person and `rewards.view_all`.
 */
@Controller()
export class RewardRecordsController {
  constructor(
    private readonly access: ProjectAccessService,
    private readonly plan: PlanMilestoneRewardCommand,
    private readonly withdraw: WithdrawMilestoneRewardCommand,
    private readonly decide: DecideMilestoneRewardCommand,
    private readonly raise: RaiseRewardChallengeCommand,
    private readonly resolve: ResolveRewardChallengeCommand,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const db = this.database.db;
    const can = (capability: Parameters<typeof context.actor.capabilities.has>[0]) =>
      context.actor.capabilities.has(capability);
    const canViewAll = can('rewards.view_all');
    const planView = async (milestoneId: string) =>
      found(await findMilestoneRewardPlan(db, milestoneId), 'Milestone reward');
    const share = async (shareId: string) => {
      const result = await queryMilestoneRewardShares(db, {
        viewerUserId: context.actor.userId,
        canViewAll,
        scope: 'all',
        shareId,
        page: 1,
        pageSize: 1,
      });
      return found(result.items[0], 'Milestone reward');
    };
    const challenge = async (challengeId: string) => {
      const result = await queryRewardChallenges(db, {
        viewerUserId: context.actor.userId,
        canViewAll,
        scope: 'review',
        challengeId,
        page: 1,
        pageSize: 1,
      });
      return found(result.items[0], 'Challenge');
    };
    return tsRestHandler(routes, {
      listProjectMilestoneRewards: async ({ params }) => {
        if (!can('rewards.manage_policies') && !can('rewards.decide') && !canViewAll) {
          throw new ForbiddenError();
        }
        await this.access.requireView(context.actor, params.id);
        return { status: 200, body: await listProjectMilestoneRewards(db, params.id) };
      },
      saveMilestoneReward: async ({ params, body }) => {
        await this.plan.execute(context, params.id, body);
        return { status: 200, body: await planView(params.id) };
      },
      withdrawMilestoneReward: async ({ params, body }) => {
        await this.withdraw.execute(context, params.id, body);
        return { status: 200, body: await planView(params.id) };
      },
      listMilestoneRewards: async ({ query }) => {
        if (query.scope === 'all' && !canViewAll && !can('rewards.decide')) {
          throw new ForbiddenError();
        }
        requireCapability(context, 'rewards.view_own');
        const result = await queryMilestoneRewardShares(db, {
          ...query,
          viewerUserId: context.actor.userId,
          canViewAll,
        });
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
      decideMilestoneReward: async ({ params, body }) => {
        await this.decide.execute(context, params.id, body);
        return { status: 200, body: await share(params.id) };
      },
      listRewardChallenges: async ({ query }) => {
        requireCapability(
          context,
          query.scope === 'review' ? 'rewards.decide' : 'rewards.view_own',
        );
        const result = await queryRewardChallenges(db, {
          ...query,
          viewerUserId: context.actor.userId,
          canViewAll,
        });
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
      raiseRewardChallenge: async ({ body }) => {
        const { challengeId } = await this.raise.execute(
          context,
          { kind: body.recordKind, recordId: body.recordId },
          body.reason,
        );
        return { status: 201, body: await challenge(challengeId) };
      },
      resolveRewardChallenge: async ({ params, body }) => {
        await this.resolve.execute(context, params.id, body);
        return { status: 200, body: await challenge(params.id) };
      },
    });
  }
}
