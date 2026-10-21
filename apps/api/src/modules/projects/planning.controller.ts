import {
  PreviewProjectPlanQuery,
  RecordClientSignOffCommand,
  type RequestContext,
  RescheduleTasksCommand,
} from '@lintel/application';
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { ScopeChangeReader } from './scope-change.reader';

const contract = apiContract.planning;

/**
 * Planning: the live plan preview of the new-project wizard, rescheduling on
 * the timeline (preview, then apply), and recording a client's sign-off.
 */
@Controller()
export class PlanningController {
  constructor(
    private readonly planPreview: PreviewProjectPlanQuery,
    private readonly reschedule: RescheduleTasksCommand,
    private readonly signOff: RecordClientSignOffCommand,
    private readonly scopeChanges: ScopeChangeReader,
  ) {}

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(contract, {
      previewProjectPlan: async ({ body }) => ({
        status: 200,
        body: await this.planPreview.execute(context, body),
      }),
      previewReschedule: async ({ params, body }) => ({
        status: 200,
        body: await this.reschedule.preview(context, params.id, body.changes),
      }),
      rescheduleTasks: async ({ params, body }) => ({
        status: 200,
        body: await this.reschedule.apply(context, params.id, body),
      }),
      recordClientSignOff: async ({ params, body }) => {
        await this.signOff.execute(context, params.id, body);
        return { status: 201, body: await this.scopeChanges.one(context, params.id) };
      },
    });
  }
}
