import type { DeliverableDetail } from '@lintel/api-contracts';
import {
  DeliverableCommands,
  DeliverableViewerQuery,
  FileCommands,
  ProjectAccessService,
  type RequestContext,
  ReviewDeliverableCommand,
  SiteUpdateCommands,
} from '@lintel/application';
import {
  type DatabaseConnection,
  findDeliverableDetail,
  findSiteUpdate,
  listProjectDeliverables,
  listSiteUpdates,
} from '@lintel/database';
import type { Actor } from '@lintel/domain';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

/** uploadFile has its own single-route handler; myApprovalQueue lives in the approvals module. */
const { uploadFile: _upload, myApprovalQueue: _approvals, ...routes } = apiContract.deliverables;

/** Deliverables with versioned review, task attachments and site updates. */
@Controller()
export class DeliverablesController {
  constructor(
    private readonly deliverables: DeliverableCommands,
    private readonly review: ReviewDeliverableCommand,
    private readonly viewer: DeliverableViewerQuery,
    private readonly files: FileCommands,
    private readonly siteUpdates: SiteUpdateCommands,
    private readonly access: ProjectAccessService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  private async detail(actor: Actor, deliverableId: string): Promise<DeliverableDetail> {
    const state = await this.viewer.execute(actor, deliverableId);
    const view = found(await findDeliverableDetail(this.database.db, deliverableId), 'Deliverable');
    return { ...view, ...state };
  }

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const actor = context.actor;
    const db = this.database.db;
    return tsRestHandler(routes, {
      attachFileToTask: async ({ params, body }) => {
        await this.files.attachToTask(context, params.id, body.fileId);
        return { status: 200, body: { fileId: body.fileId } };
      },
      listProjectDeliverables: async ({ params }) => {
        await this.access.requireView(actor, params.id);
        return { status: 200, body: await listProjectDeliverables(db, params.id) };
      },
      createDeliverable: async ({ body }) => {
        const deliverable = await this.deliverables.create(context, body);
        return { status: 201, body: await this.detail(actor, deliverable.id) };
      },
      getDeliverable: async ({ params }) => ({
        status: 200,
        body: await this.detail(actor, params.id),
      }),
      submitDeliverableVersion: async ({ params, body }) => {
        await this.deliverables.submitVersion(context, params.id, body);
        return { status: 201, body: await this.detail(actor, params.id) };
      },
      reviewDeliverableVersion: async ({ params, body }) => {
        const deliverable = await this.review.execute(context, params.id, body);
        return { status: 200, body: await this.detail(actor, deliverable.id) };
      },
      listSiteUpdates: async ({ params }) => {
        await this.access.requireView(actor, params.id);
        return { status: 200, body: await listSiteUpdates(db, params.id) };
      },
      createSiteUpdate: async ({ params, body }) => {
        const update = await this.siteUpdates.create(context, params.id, body);
        return { status: 201, body: found(await findSiteUpdate(db, update.id), 'Site update') };
      },
    });
  }
}
