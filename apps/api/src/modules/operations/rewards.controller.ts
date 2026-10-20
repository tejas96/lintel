import {
  DecideRewardEvaluationCommand,
  ManageRewardPoliciesCommands,
  type RequestContext,
  RunRewardEvaluationCommand,
} from '@lintel/application';
import {
  type DatabaseConnection,
  listRewardPolicies,
  queryRewardEvaluations,
  toPolicyView,
} from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found, pageOf, requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const operations = apiContract.operations;
const routes = {
  listRewardPolicies: operations.listRewardPolicies,
  createRewardPolicy: operations.createRewardPolicy,
  updateRewardPolicy: operations.updateRewardPolicy,
  listRewardEvaluations: operations.listRewardEvaluations,
  runRewardEvaluation: operations.runRewardEvaluation,
  decideRewardEvaluation: operations.decideRewardEvaluation,
};

/** Reward policies, evaluation runs and decisions. Amounts follow `rewards.view_all`. */
@Controller()
export class RewardsController {
  constructor(
    private readonly policies: ManageRewardPoliciesCommands,
    private readonly evaluation: RunRewardEvaluationCommand,
    private readonly decision: DecideRewardEvaluationCommand,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const db = this.database.db;
    const can = (capability: Parameters<typeof context.actor.capabilities.has>[0]) =>
      context.actor.capabilities.has(capability);
    return tsRestHandler(routes, {
      listRewardPolicies: async () => {
        requireCapability(context, 'rewards.view_own');
        const managing =
          can('rewards.manage_policies') || can('rewards.view_all') || can('rewards.decide');
        return { status: 200, body: await listRewardPolicies(db, managing) };
      },
      createRewardPolicy: async ({ body }) => ({
        status: 201,
        body: toPolicyView(await this.policies.create(context, body)),
      }),
      updateRewardPolicy: async ({ params, body }) => {
        const { version, ...input } = body;
        return {
          status: 200,
          body: toPolicyView(await this.policies.update(context, params.id, version, input)),
        };
      },
      listRewardEvaluations: async ({ query }) => {
        requireCapability(context, query.scope === 'all' ? 'rewards.view_all' : 'rewards.view_own');
        const result = await queryRewardEvaluations(db, {
          ...query,
          viewerUserId: context.actor.userId,
          canViewAll: can('rewards.view_all'),
        });
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
      runRewardEvaluation: async ({ params, body }) => ({
        status: 200,
        body: await this.evaluation.execute(context, params.id, body.periodStart),
      }),
      decideRewardEvaluation: async ({ params, body }) => {
        await this.decision.execute(context, params.id, body);
        const result = await queryRewardEvaluations(db, {
          viewerUserId: context.actor.userId,
          canViewAll: can('rewards.view_all'),
          scope: 'all',
          evaluationId: params.id,
          page: 1,
          pageSize: 1,
        });
        return { status: 200, body: found(result.items[0], 'Reward evaluation') };
      },
    });
  }
}
