import type { ManagedLeaveType } from '@lintel/api-contracts';
import {
  type ApplicationStores,
  type LeaveTypeAdminRecord,
  leaveRulesOf,
  ManageLeaveTypesCommands,
  type RequestContext,
  type UnitOfWork,
  UpdateLeaveRulesCommand,
} from '@lintel/application';
import { type DatabaseConnection, loadLeaveTypeUsage } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { DATABASE_CONNECTION, UNIT_OF_WORK } from '../../infrastructure/tokens';

const contract = apiContract.leavePolicies;

/** Leave types and leave rules (`leave.manage_policies`). Rules live in the commands. */
@Controller()
export class LeavePoliciesController {
  constructor(
    private readonly leaveTypes: ManageLeaveTypesCommands,
    private readonly leaveRules: UpdateLeaveRulesCommand,
    private readonly business: BusinessContextService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork<ApplicationStores>,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  private async present(types: readonly LeaveTypeAdminRecord[]): Promise<ManagedLeaveType[]> {
    const usage = await loadLeaveTypeUsage(
      this.database.db,
      types.map((type) => type.id),
    );
    return types.map((type) => ({ ...type, ...usage(type.id) }));
  }

  private async presentOne(type: LeaveTypeAdminRecord): Promise<ManagedLeaveType> {
    const [presented] = await this.present([type]);
    return presented ?? { ...type, requestCount: 0, openRequestCount: 0 };
  }

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(contract, {
      getLeavePolicies: async () => {
        requireCapability(context, 'leave.manage_policies');
        const [types, settings] = await Promise.all([
          this.uow.stores.leaveTypes.list(),
          this.uow.stores.settings.organization(),
        ]);
        return {
          status: 200,
          body: { rules: leaveRulesOf(settings), types: await this.present(types) },
        };
      },
      createLeaveType: async ({ body }) => ({
        status: 201,
        body: await this.presentOne(await this.leaveTypes.create(context, body)),
      }),
      updateLeaveType: async ({ params, body }) => {
        const { version, ...changes } = body;
        const updated = await this.leaveTypes.update(context, params.id, { version, changes });
        return { status: 200, body: await this.presentOne(updated) };
      },
      retireLeaveType: async ({ params, body }) => {
        const retired = await this.leaveTypes.setActive(context, params.id, body.version, false);
        return { status: 200, body: await this.presentOne(retired) };
      },
      reactivateLeaveType: async ({ params, body }) => {
        const back = await this.leaveTypes.setActive(context, params.id, body.version, true);
        return { status: 200, body: await this.presentOne(back) };
      },
      updateLeaveRules: async ({ body }) => {
        const rules = await this.leaveRules.execute(context, body);
        this.business.invalidate();
        return { status: 200, body: rules };
      },
    });
  }
}
