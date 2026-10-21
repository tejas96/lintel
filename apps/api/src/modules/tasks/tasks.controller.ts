import {
  AssignTaskCommands,
  CreateTaskCommand,
  ProjectAccessService,
  type RequestContext,
  TransitionTaskCommand,
  UpdateTaskCommand,
} from '@lintel/application';
import { type DatabaseConnection, queryTasks } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { pageOf } from '../../common/http/access';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';
import { TaskDetailPresenter } from './task-detail.presenter';

const {
  listTasks,
  createTask,
  getTask,
  updateTask,
  transitionTask,
  assignTask,
  setCollaborators,
  acknowledgeTask,
} = apiContract.tasks;
const routes = {
  listTasks,
  createTask,
  getTask,
  updateTask,
  transitionTask,
  assignTask,
  setCollaborators,
  acknowledgeTask,
};

/** Task lifecycle: list, create, read, edit, move through statuses and assign. */
@Controller()
export class TasksController {
  constructor(
    private readonly createCommand: CreateTaskCommand,
    private readonly updateCommand: UpdateTaskCommand,
    private readonly transitionCommand: TransitionTaskCommand,
    private readonly assignCommands: AssignTaskCommands,
    private readonly presenter: TaskDetailPresenter,
    private readonly access: ProjectAccessService,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const actor = context.actor;
    const detail = (taskId: string) => this.presenter.detail(actor, taskId);
    return tsRestHandler(routes, {
      listTasks: async ({ query }) => {
        if (query.projectId) await this.access.requireView(actor, query.projectId);
        const result = await queryTasks(this.database.db, {
          ...query,
          visibleProjectIds: await this.access.visibleProjectIds(actor),
          today: await this.business.today(),
          clock: await this.business.planningClock(),
        });
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
      createTask: async ({ body }) => {
        const task = await this.createCommand.execute(context, body);
        return { status: 201, body: await detail(task.id) };
      },
      getTask: async ({ params }) => ({ status: 200, body: await detail(params.id) }),
      updateTask: async ({ params, body }) => {
        const { version, scheduleChangeReason, ...changes } = body;
        await this.updateCommand.execute(context, params.id, {
          version,
          changes,
          scheduleChangeReason,
        });
        return { status: 200, body: await detail(params.id) };
      },
      transitionTask: async ({ params, body }) => {
        await this.transitionCommand.execute(context, params.id, body);
        return { status: 200, body: await detail(params.id) };
      },
      assignTask: async ({ params, body }) => {
        await this.assignCommands.assign(context, params.id, body);
        return { status: 200, body: await detail(params.id) };
      },
      setCollaborators: async ({ params, body }) => {
        await this.assignCommands.setCollaborators(context, params.id, body.userIds);
        return { status: 200, body: await detail(params.id) };
      },
      acknowledgeTask: async ({ params }) => {
        await this.assignCommands.acknowledge(context, params.id);
        return { status: 200, body: await detail(params.id) };
      },
    });
  }
}
