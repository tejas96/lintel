import {
  DateChangeImpactQuery,
  DateChangeViewerQuery,
  DecideDateChangeCommand,
  type RequestContext,
  RequestDateChangeCommands,
  withDateChangeActions,
} from '@lintel/application';
import {
  type DatabaseConnection,
  findDateChangeRequest,
  listTaskDateChanges,
} from '@lintel/database';
import type { Actor } from '@lintel/domain';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const routes = apiContract.dateChanges;

/** New-date requests: ask, list, decide, withdraw. */
@Controller()
export class DateChangesController {
  constructor(
    private readonly requests: RequestDateChangeCommands,
    private readonly decide: DecideDateChangeCommand,
    private readonly viewer: DateChangeViewerQuery,
    private readonly impact: DateChangeImpactQuery,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  /** One request with what this viewer may do about it. Hidden requests answer 404. */
  private async present(actor: Actor, requestId: string) {
    const state = await this.viewer.forRequest(actor, requestId, await this.business.today());
    const view = found(
      await findDateChangeRequest(this.database.db, requestId),
      'New-date request',
    );
    const [decorated] = withDateChangeActions([view], state);
    return found(decorated, 'New-date request');
  }

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const actor = context.actor;
    return tsRestHandler(routes, {
      listTaskDateChanges: async ({ params }) => {
        const state = await this.viewer.forTask(actor, params.id, await this.business.today());
        const views = await listTaskDateChanges(this.database.db, params.id);
        return {
          status: 200,
          body: {
            requests: withDateChangeActions(views, state),
            viewerCanRequest: state.canRequest,
            requestUnavailableReason: state.requestUnavailableReason,
          },
        };
      },
      requestDateChange: async ({ params, body }) => {
        const request = await this.requests.request(context, params.id, body);
        return { status: 201, body: await this.present(actor, request.id) };
      },
      getDateChange: async ({ params }) => ({
        status: 200,
        body: await this.present(actor, params.id),
      }),
      getDateChangeImpact: async ({ params }) => ({
        status: 200,
        body: await this.impact.execute(actor, params.id),
      }),
      decideDateChange: async ({ params, body }) => {
        await this.decide.execute(context, params.id, body);
        return { status: 200, body: await this.present(actor, params.id) };
      },
      withdrawDateChange: async ({ params, body }) => {
        await this.requests.withdraw(context, params.id, body.version);
        return { status: 200, body: await this.present(actor, params.id) };
      },
    });
  }
}
