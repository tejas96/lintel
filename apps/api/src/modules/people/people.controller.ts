import { ManagePeopleCommands, type RequestContext } from '@lintel/application';
import { type DatabaseConnection, findDirectoryEntry, queryDirectory } from '@lintel/database';
import type { Clock } from '@lintel/shared';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found, pageOf, phoneFromInput, requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { CLOCK, DATABASE_CONNECTION } from '../../infrastructure/tokens';

const contract = apiContract.people;

/** Studio directory and people administration. Reads use read models; writes use commands. */
@Controller()
export class PeopleController {
  constructor(
    private readonly commands: ManagePeopleCommands,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async entry(userId: string) {
    return found(await findDirectoryEntry(this.database.db, userId), 'Person');
  }

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(contract, {
      listPeople: async ({ query }) => {
        requireCapability(context, 'users.view_directory');
        const result = await queryDirectory(this.database.db, query);
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
      getPerson: async ({ params }) => {
        requireCapability(context, 'users.view_directory');
        return { status: 200, body: await this.entry(params.id) };
      },
      createPerson: async ({ body }) => {
        const { countryCallingCode, nationalNumber, workingCalendarId, ...rest } = body;
        const phoneE164 = phoneFromInput({ countryCallingCode, nationalNumber });
        const person = await this.commands.create(context, {
          ...rest,
          phoneE164,
          workingCalendarId: workingCalendarId ?? null,
        });
        return { status: 201, body: await this.entry(person.id) };
      },
      updatePerson: async ({ params, body }) => {
        const { version, countryCallingCode, nationalNumber, ...changes } = body;
        const phone =
          countryCallingCode && nationalNumber
            ? { phoneE164: phoneFromInput({ countryCallingCode, nationalNumber }) }
            : {};
        await this.commands.update(context, params.id, version, { ...changes, ...phone });
        return { status: 200, body: await this.entry(params.id) };
      },
      deactivatePerson: async ({ params, body }) => {
        await this.commands.setActive(context, params.id, body.version, false, body.reason);
        return { status: 200, body: await this.entry(params.id) };
      },
      reactivatePerson: async ({ params, body }) => {
        await this.commands.setActive(context, params.id, body.version, true, null);
        return { status: 200, body: await this.entry(params.id) };
      },
      touch: async () => {
        void this.clock;
        return { status: 204, body: undefined };
      },
    });
  }
}
