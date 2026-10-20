import {
  CompleteMilestoneCommand,
  CreateProjectCommand,
  ManageProjectCommands,
  ProjectAccessService,
  type RequestContext,
} from '@lintel/application';
import { type DatabaseConnection, queryProjectActivity, queryProjects } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { pageOf } from '../../common/http/access';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';
import { ProjectDetailReader } from './project-detail.reader';
import { projectRoutes } from './project-routes';

/** Projects, their team, status and milestones. Scope changes live in their own controller. */
@Controller()
export class ProjectsController {
  constructor(
    private readonly createProject: CreateProjectCommand,
    private readonly manage: ManageProjectCommands,
    private readonly completeMilestone: CompleteMilestoneCommand,
    private readonly access: ProjectAccessService,
    private readonly reader: ProjectDetailReader,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(projectRoutes)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(projectRoutes, {
      listProjects: async ({ query }) => {
        const [visibleProjectIds, today] = await Promise.all([
          this.access.visibleProjectIds(context.actor),
          this.business.today(),
        ]);
        const result = await queryProjects(this.database.db, {
          ...query,
          visibleProjectIds,
          today,
        });
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
      createProject: async ({ body }) => {
        const { id } = await this.createProject.execute(context, body);
        return { status: 201, body: await this.reader.detail(context, id) };
      },
      getProject: async ({ params }) => ({
        status: 200,
        body: await this.reader.detail(context, params.id),
      }),
      updateProject: async ({ params, body }) => {
        const { version, ...changes } = body;
        await this.manage.update(context, params.id, version, changes);
        return { status: 200, body: await this.reader.detail(context, params.id) };
      },
      changeProjectStatus: async ({ params, body }) => {
        await this.manage.changeStatus(context, params.id, body.version, body.status, body.note);
        return { status: 200, body: await this.reader.detail(context, params.id) };
      },
      setProjectMembers: async ({ params, body }) => {
        await this.manage.setMembers(context, params.id, body.members);
        return { status: 200, body: await this.reader.detail(context, params.id) };
      },
      completeMilestone: async ({ params, body }) => {
        const { projectId } = await this.completeMilestone.execute(
          context,
          params.id,
          body.version,
          body.note,
        );
        return { status: 200, body: await this.reader.detail(context, projectId) };
      },
      listProjectActivity: async ({ params, query }) => {
        await this.access.requireView(context.actor, params.id);
        const result = await queryProjectActivity(this.database.db, params.id, query);
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
    });
  }
}
