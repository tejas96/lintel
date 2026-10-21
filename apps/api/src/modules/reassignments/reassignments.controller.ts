import {
  DecideReassignmentCommand,
  ReassignmentViewerQuery,
  type RequestContext,
  RequestReassignmentCommands,
  withReassignmentActions,
} from '@lintel/application';
import {
  type DatabaseConnection,
  findReassignmentRequest,
  listTaskReassignments,
} from '@lintel/database';
import type { Actor } from '@lintel/domain';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const routes = apiContract.reassignments;

/** Task reassignment requests: ask, list, decide, withdraw. */
@Controller()
export class ReassignmentsController {
  constructor(
    private readonly requests: RequestReassignmentCommands,
    private readonly decide: DecideReassignmentCommand,
    private readonly viewer: ReassignmentViewerQuery,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  /** One request with what this viewer may do about it. Hidden requests answer 404. */
  private async present(actor: Actor, requestId: string) {
    const state = await this.viewer.forRequest(actor, requestId);
    const view = found(
      await findReassignmentRequest(this.database.db, requestId),
      'Reassignment request',
    );
    const [decorated] = withReassignmentActions([view], state);
    return found(decorated, 'Reassignment request');
  }

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const actor = context.actor;
    return tsRestHandler(routes, {
      listTaskReassignments: async ({ params }) => {
        const state = await this.viewer.forTask(actor, params.id);
        const views = await listTaskReassignments(this.database.db, params.id);
        return {
          status: 200,
          body: {
            requests: withReassignmentActions(views, state),
            viewerCanRequest: state.canRequest,
            requestUnavailableReason: state.requestUnavailableReason,
          },
        };
      },
      requestReassignment: async ({ params, body }) => {
        const request = await this.requests.request(context, params.id, body);
        return { status: 201, body: await this.present(actor, request.id) };
      },
      getReassignment: async ({ params }) => ({
        status: 200,
        body: await this.present(actor, params.id),
      }),
      decideReassignment: async ({ params, body }) => {
        await this.decide.execute(context, params.id, body);
        return { status: 200, body: await this.present(actor, params.id) };
      },
      withdrawReassignment: async ({ params, body }) => {
        await this.requests.withdraw(context, params.id, body.version);
        return { status: 200, body: await this.present(actor, params.id) };
      },
    });
  }
}
