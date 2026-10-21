import type { WorkQueue } from '@lintel/api-contracts';
import {
  MyWorkQueueQuery,
  PriorityConflictCommands,
  type RequestContext,
  type WorkQueueItem,
  type WorkQueueResult,
  WorkSessionCommands,
} from '@lintel/application';
import type { TaskSummaryView } from '@lintel/database';
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { TaskDetailPresenter } from '../tasks/task-detail.presenter';

const contract = apiContract.work;

function presentItem(item: WorkQueueItem<TaskSummaryView>) {
  return {
    task: item.task,
    score: item.score,
    bucket: item.bucket,
    headline: item.headline,
    reasons: item.reasons.map((reason) => ({ ...reason })),
  };
}

export function presentWorkQueue(
  result: WorkQueueResult<TaskSummaryView>,
  workTrackingEnabled: boolean,
): WorkQueue {
  return {
    today: result.today,
    next: result.next ? presentItem(result.next) : null,
    items: result.items.map(presentItem),
    counts: result.counts,
    workload: result.workload,
    reviewsWaitingForMe: result.reviewsWaitingForMe,
    recentlyCompleted: result.recentlyCompleted,
    strategy: result.strategy,
    workTrackingEnabled,
  };
}

/** The signed-in person's day: prioritised queue, work sessions and priority conflicts. */
@Controller()
export class WorkController {
  constructor(
    private readonly queue: MyWorkQueueQuery<TaskSummaryView>,
    private readonly sessions: WorkSessionCommands,
    private readonly conflicts: PriorityConflictCommands,
    private readonly presenter: TaskDetailPresenter,
    private readonly business: BusinessContextService,
  ) {}

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    const actor = context.actor;
    return tsRestHandler(contract, {
      myWorkQueue: async () => ({
        status: 200,
        body: presentWorkQueue(
          await this.queue.execute(actor),
          (await this.business.settings()).workTrackingEnabled,
        ),
      }),
      startWork: async ({ params }) => {
        await this.sessions.start(context, params.id);
        return { status: 200, body: await this.presenter.detail(actor, params.id) };
      },
      pauseWork: async ({ params }) => {
        await this.sessions.pause(context, params.id);
        return { status: 200, body: await this.presenter.detail(actor, params.id) };
      },
      raisePriorityConflict: async ({ body }) => ({
        status: 201,
        body: await this.conflicts.raise(context, body.taskIds, body.note),
      }),
      resolvePriorityConflict: async ({ params, body }) => ({
        status: 200,
        body: await this.conflicts.resolve(context, params.id, body.resolution),
      }),
    });
  }
}
