import {
  type ApplicationStores,
  ProjectAccessService,
  ProjectCostCommands,
  type ProjectCostRecord,
  type RequestContext,
  requireProjectFinances,
  type UnitOfWork,
} from '@lintel/application';
import {
  type DatabaseConnection,
  loadProjectProfitability,
  toCostEntryViews,
} from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION, UNIT_OF_WORK } from '../../infrastructure/tokens';

const routes = apiContract.projectCosts;

/**
 * Project profitability and the cost ledger. Every route checks finance
 * access to the project and that profitability is switched on (see
 * `requireProjectFinances`); writes are audited by the commands.
 */
@Controller()
export class ProjectCostsController {
  constructor(
    private readonly commands: ProjectCostCommands,
    private readonly access: ProjectAccessService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork<ApplicationStores>,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  private async entryView(record: ProjectCostRecord) {
    const [view] = await toCostEntryViews(this.database.db, [record]);
    return found(view, 'Cost entry');
  }

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(routes, {
      getProjectProfitability: async ({ params }) => {
        const { currency } = await requireProjectFinances(
          this.access,
          this.uow.stores.settings,
          context.actor,
          params.projectId,
          'read',
        );
        const view = await loadProjectProfitability(this.database.db, params.projectId, currency);
        return { status: 200, body: found(view, 'Project') };
      },
      recordProjectCost: async ({ params, body }) => {
        const record = await this.commands.record(context, params.projectId, body);
        return { status: 201, body: await this.entryView(record) };
      },
      voidProjectCost: async ({ params, body }) => {
        const record = await this.commands.void(context, params.projectId, params.costId, {
          reason: body.reason,
          expectedVersion: body.version,
        });
        return { status: 200, body: await this.entryView(record) };
      },
    });
  }
}
