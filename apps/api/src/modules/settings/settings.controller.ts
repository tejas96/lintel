import {
  type ApplicationStores,
  ManageSettingsCommands,
  type RequestContext,
  type UnitOfWork,
} from '@lintel/application';
import { ROLES } from '@lintel/domain';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';

/** Health routes stay in HealthModule; this controller serves the studio settings routes. */
const {
  health: _health,
  readiness: _readiness,
  aiStatus: _aiStatus,
  ...settingsRoutes
} = apiContract.platform;

/**
 * Studio settings, role capabilities and holidays. Reading the organisation
 * and holidays is open to everyone signed in (leave planning needs them);
 * changes need `organization.manage_settings`, roles need `roles.manage`.
 */
@Controller()
export class SettingsController {
  constructor(
    private readonly commands: ManageSettingsCommands,
    private readonly business: BusinessContextService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork<ApplicationStores>,
  ) {}

  @TsRestHandler(settingsRoutes)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(settingsRoutes, {
      getOrganization: async () => ({
        status: 200,
        body: await this.uow.stores.settings.organization(),
      }),
      updateOrganization: async ({ body }) => {
        const updated = await this.commands.updateOrganization(context, body);
        this.business.invalidate();
        return { status: 200, body: updated };
      },
      getRoleCapabilities: async () => {
        requireCapability(context, 'roles.manage');
        const grants = await this.uow.stores.settings.roleCapabilities();
        return {
          status: 200,
          body: ROLES.map((role) => ({
            role,
            capabilities: grants.find((grant) => grant.role === role)?.capabilities ?? [],
          })),
        };
      },
      updateRoleCapabilities: async ({ params, body }) => {
        const capabilities = await this.commands.updateRoleCapabilities(
          context,
          params.role,
          body.capabilities,
        );
        return { status: 200, body: { role: params.role, capabilities } };
      },
      listHolidays: async () => ({
        status: 200,
        body: await this.uow.stores.settings.listHolidays(),
      }),
      addHoliday: async ({ body }) => ({
        status: 201,
        body: await this.commands.addHoliday(context, body.date, body.name),
      }),
      removeHoliday: async ({ params }) => {
        await this.commands.removeHoliday(context, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}
