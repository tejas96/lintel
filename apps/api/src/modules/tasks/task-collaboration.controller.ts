import {
  ProjectAccessService,
  type RequestContext,
  TaskBlockerCommands,
  TaskCommentCommands,
  TaskStructureCommands,
} from '@lintel/application';
import {
  type DatabaseConnection,
  findTaskComment,
  listOpenBlockers,
  listTaskComments,
} from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';
import { TaskDetailPresenter } from './task-detail.presenter';

const {
  listTasks: _list,
  createTask: _create,
  getTask: _get,
  updateTask: _update,
  transitionTask: _transition,
  assignTask: _assign,
  setCollaborators: _collaborators,
  acknowledgeTask: _acknowledge,
  ...routes
} = apiContract.tasks;

/** Working on a task together: prerequisites, checklist, blockers and comments. */
@Controller()
export class TaskCollaborationController {
  constructor(
    private readonly structure: TaskStructureCommands,
    private readonly blockers: TaskBlockerCommands,
    private readonly comments: TaskCommentCommands,
    private readonly presenter: TaskDetailPresenter,
    private readonly access: ProjectAccessService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const actor = context.actor;
    const detail = async (taskId: string) => ({
      status: 200 as const,
      body: await this.presenter.detail(actor, taskId),
    });
    return tsRestHandler(routes, {
      addDependency: async ({ params, body }) => {
        await this.structure.addDependency(context, params.id, body.dependsOnTaskId);
        return detail(params.id);
      },
      removeDependency: async ({ params }) => {
        await this.structure.removeDependency(context, params.id, params.dependsOnTaskId);
        return detail(params.id);
      },
      addChecklistItem: async ({ params, body }) => {
        await this.structure.addChecklistItem(context, params.id, body);
        return detail(params.id);
      },
      toggleChecklistItem: async ({ params, body }) =>
        detail(await this.structure.toggleChecklistItem(context, params.id, body.completed)),
      removeChecklistItem: async ({ params }) =>
        detail(await this.structure.removeChecklistItem(context, params.id)),
      reportBlocker: async ({ params, body }) => {
        await this.blockers.report(context, params.id, body);
        return detail(params.id);
      },
      resolveBlocker: async ({ params, body }) =>
        detail(await this.blockers.resolve(context, params.id, body)),
      listOpenBlockers: async ({ query }) => {
        if (query.projectId) await this.access.requireView(actor, query.projectId);
        const scope = query.projectId
          ? [query.projectId]
          : await this.access.visibleProjectIds(actor);
        return { status: 200, body: await listOpenBlockers(this.database.db, scope) };
      },
      listComments: async ({ params }) => {
        await this.comments.authorizeRead(actor, params.id);
        return { status: 200, body: await listTaskComments(this.database.db, params.id) };
      },
      addComment: async ({ params, body }) => {
        const comment = await this.comments.add(context, params.id, body.body);
        const view = await findTaskComment(this.database.db, comment.id);
        return { status: 201, body: found(view, 'Comment') };
      },
    });
  }
}
