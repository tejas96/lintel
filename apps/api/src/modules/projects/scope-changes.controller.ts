import {
  DecideScopeChangeCommand,
  ProjectAccessService,
  ProposeScopeChangeCommand,
  type RequestContext,
} from '@lintel/application';
import { type DatabaseConnection, findScopeChange, listScopeChanges } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found } from '../../common/http/access';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';
import { scopeChangeRoutes as scopeRoutes } from './project-routes';

/** Scope change requests: preview, propose, list and decide. */
@Controller()
export class ScopeChangesController {
  constructor(
    private readonly propose: ProposeScopeChangeCommand,
    private readonly decide: DecideScopeChangeCommand,
    private readonly access: ProjectAccessService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  private async view(scopeChangeId: string) {
    return found(await findScopeChange(this.database.db, scopeChangeId), 'Scope change');
  }

  @TsRestHandler(scopeRoutes)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(scopeRoutes, {
      listScopeChanges: async ({ params }) => {
        await this.access.requireView(context.actor, params.id);
        return { status: 200, body: await listScopeChanges(this.database.db, params.id) };
      },
      previewScopeChange: async ({ params, body }) => ({
        status: 200,
        body: await this.propose.preview(context, params.id, body.taskShifts),
      }),
      proposeScopeChange: async ({ params, body }) => {
        const { id } = await this.propose.propose(context, params.id, body);
        return { status: 201, body: await this.view(id) };
      },
      decideScopeChange: async ({ params, body }) => {
        await this.decide.execute(context, params.id, {
          decision: body.decision,
          note: body.note,
          expectedVersion: body.version,
        });
        return { status: 200, body: await this.view(params.id) };
      },
    });
  }
}
