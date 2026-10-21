import {
  type ApplicationStores,
  ManageWorkingCalendarsCommands,
  type RequestContext,
  type UnitOfWork,
  type WorkingCalendarRecord,
} from '@lintel/application';
import { ForbiddenError } from '@lintel/shared';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';

const contract = apiContract.workingCalendars;

const present = (calendar: WorkingCalendarRecord) => ({
  ...calendar,
  workingWeekdays: [...calendar.workingWeekdays],
});

/** The studio week and other working weeks. Rules live in ManageWorkingCalendarsCommands. */
@Controller()
export class WorkingCalendarsController {
  constructor(
    private readonly commands: ManageWorkingCalendarsCommands,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork<ApplicationStores>,
  ) {}

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(contract, {
      listWorkingCalendars: async () => {
        const held = context.actor.capabilities;
        if (!held.has('organization.manage_settings') && !held.has('users.manage')) {
          throw new ForbiddenError();
        }
        const calendars = await this.uow.stores.calendars.list();
        return { status: 200, body: calendars.map(present) };
      },
      createWorkingCalendar: async ({ body }) => ({
        status: 201,
        body: present(await this.commands.create(context, body)),
      }),
      updateWorkingCalendar: async ({ params, body }) => {
        const { version, ...changes } = body;
        const updated = await this.commands.update(context, params.id, { version, changes });
        return { status: 200, body: present(updated) };
      },
      removeWorkingCalendar: async ({ params }) => {
        await this.commands.remove(context, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}
