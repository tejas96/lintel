import {
  DecideScopeChangeCommand,
  ProposeScopeChangeCommand,
  type RequestContext,
} from '@lintel/application';
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { scopeChangeRoutes as scopeRoutes } from './project-routes';
import { ScopeChangeReader } from './scope-change.reader';

/** Scope change requests: preview, propose, list and decide. */
@Controller()
export class ScopeChangesController {
  constructor(
    private readonly propose: ProposeScopeChangeCommand,
    private readonly decide: DecideScopeChangeCommand,
    private readonly reader: ScopeChangeReader,
  ) {}

  @TsRestHandler(scopeRoutes)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(scopeRoutes, {
      listScopeChanges: async ({ params }) => ({
        status: 200,
        body: await this.reader.list(context, params.id),
      }),
      previewScopeChange: async ({ params, body }) => ({
        status: 200,
        body: await this.propose.preview(context, params.id, body),
      }),
      proposeScopeChange: async ({ params, body }) => {
        const { costImpactMinor, costCategory, feeImpactMinor, ...proposal } = body;
        const { id } = await this.propose.propose(context, params.id, {
          ...proposal,
          money: { costImpactMinor, costCategory, feeImpactMinor },
        });
        return { status: 201, body: await this.reader.one(context, id) };
      },
      decideScopeChange: async ({ params, body }) => {
        await this.decide.execute(context, params.id, {
          decision: body.decision,
          note: body.note,
          expectedVersion: body.version,
        });
        return { status: 200, body: await this.reader.one(context, params.id) };
      },
    });
  }
}
