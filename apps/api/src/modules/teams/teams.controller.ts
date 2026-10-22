import { ManageTeamsCommands, type RequestContext } from '@lintel/application';
import { type DatabaseConnection, findTeam, listTeams } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found, requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const contract = apiContract.teams;

/** Studio teams. Reads use the read model; writes go through `ManageTeamsCommands`. */
@Controller()
export class TeamsController {
  constructor(
    private readonly commands: ManageTeamsCommands,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  private async view(teamId: string) {
    return found(await findTeam(this.database.db, teamId), 'Team');
  }

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(contract, {
      listTeams: async ({ query }) => {
        requireCapability(context, 'users.view_directory');
        return { status: 200, body: await listTeams(this.database.db, query.status) };
      },
      createTeam: async ({ body }) => {
        const team = await this.commands.create(context, {
          name: body.name,
          description: body.description ?? null,
          leadUserId: body.leadUserId ?? null,
        });
        return { status: 201, body: await this.view(team.id) };
      },
      updateTeam: async ({ params, body }) => {
        const { version, ...changes } = body;
        await this.commands.update(context, params.id, version, changes);
        return { status: 200, body: await this.view(params.id) };
      },
      archiveTeam: async ({ params, body }) => {
        await this.commands.setActive(context, params.id, body.version, false);
        return { status: 200, body: await this.view(params.id) };
      },
      restoreTeam: async ({ params, body }) => {
        await this.commands.setActive(context, params.id, body.version, true);
        return { status: 200, body: await this.view(params.id) };
      },
    });
  }
}
