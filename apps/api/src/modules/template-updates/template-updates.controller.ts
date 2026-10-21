import {
  ApplyTemplateUpdateCommand,
  PreviewTemplateUpdateQuery,
  type RequestContext,
  type TemplateUpdatePreview,
  TemplateUpdateStatusQuery,
} from '@lintel/application';
import {
  type DatabaseConnection,
  type DatabaseExecutor,
  listTemplateUpdateHistory,
  loadUserSummaries,
  pickUser,
} from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const routes = apiContract.templateUpdates;

/** Turns the owners of added tasks into people the contract can show. */
async function withOwners(db: DatabaseExecutor, preview: TemplateUpdatePreview) {
  const people = await loadUserSummaries(
    db,
    preview.items.map((item) => item.schedule?.ownerUserId ?? null),
  );
  return {
    ...preview,
    items: preview.items.map(({ schedule, ...item }) => ({
      ...item,
      fields: item.fields.map((field) => ({
        ...field,
        added: [...field.added],
        removed: [...field.removed],
      })),
      schedule: schedule
        ? {
            plannedStartDate: schedule.plannedStartDate,
            dueDate: schedule.dueDate,
            owner: pickUser(people, schedule.ownerUserId),
          }
        : null,
    })),
  };
}

/** Template version status, dry-run preview and apply for one project. */
@Controller()
export class TemplateUpdatesController {
  constructor(
    private readonly status: TemplateUpdateStatusQuery,
    private readonly preview: PreviewTemplateUpdateQuery,
    private readonly apply: ApplyTemplateUpdateCommand,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const db = this.database.db;
    return tsRestHandler(routes, {
      getTemplateUpdateStatus: async ({ params }) => {
        const status = await this.status.execute(context.actor, params.id);
        return {
          status: 200,
          body: { ...status, history: await listTemplateUpdateHistory(db, params.id) },
        };
      },
      previewTemplateUpdate: async ({ params, body }) => ({
        status: 200,
        body: await withOwners(db, await this.preview.execute(context, params.id, body)),
      }),
      applyTemplateUpdate: async ({ params, body }) => {
        const applied = await this.apply.execute(context, params.id, {
          targetVersionId: body.targetVersionId,
          ticked: body.ticked,
          extendPlannedEnd: body.extendPlannedEnd,
          expectedProjectVersion: body.version,
        });
        const { summary } = applied;
        return {
          status: 200,
          body: {
            toVersionNumber: applied.toVersionNumber,
            added: summary.added,
            changed: summary.changed,
            cancelled: summary.cancelled,
            heldBack: summary.heldBack,
            extendedPlannedEndTo: summary.extendedPlannedEndTo,
          },
        };
      },
    });
  }
}
