import {
  CapacityQuery,
  CoverSuggestionsQuery,
  ProjectAccessService,
  planCommandCenter,
  type RequestContext,
} from '@lintel/application';
import {
  type DatabaseConnection,
  loadCommandCenterBriefing,
  loadProjectRisks,
  managesAnyProject,
  riskContextFor,
  toCoverSuggestionsView,
} from '@lintel/database';
import { type Clock, toCalendarDate } from '@lintel/shared';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, DATABASE_CONNECTION } from '../../infrastructure/tokens';

const routes = apiContract.insights;

/** Health score, risk cards and cover suggestions: problems explained, next action named. */
@Controller()
export class InsightsController {
  constructor(
    private readonly capacityQuery: CapacityQuery,
    private readonly access: ProjectAccessService,
    private readonly cover: CoverSuggestionsQuery,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    const db = this.database.db;
    return tsRestHandler(routes, {
      commandCenterBriefing: async ({ query }) => {
        const [today, settings, manages] = await Promise.all([
          this.business.today(),
          this.business.settings(),
          managesAnyProject(db, context.actor.userId),
        ]);
        // The same access rule and filters as the command center (403 for everyone else).
        const plan = planCommandCenter(context.actor, query, today, manages);
        const body = await loadCommandCenterBriefing(db, plan, {
          timeZone: settings.timeZone,
          now: this.clock.now(),
          utilisation: (userIds, span) =>
            this.capacityQuery.rowsForUsers(userIds, {
              start: toCalendarDate(span.start),
              end: toCalendarDate(span.end),
            }),
        });
        return { status: 200, body };
      },
      projectRisks: async ({ params }) => {
        // Missing and hidden projects both answer 404.
        await this.access.requireView(context.actor, params.id);
        const now = this.clock.now();
        const riskContext = await riskContextFor(db, await this.business.today(), now);
        const risks = await loadProjectRisks(db, params.id, riskContext);
        return { status: 200, body: { generatedAt: now.toISOString(), ...risks } };
      },
      leaveCoverSuggestions: async ({ params }) => {
        const result = await this.cover.forLeaveRequest(context, params.id);
        return {
          status: 200,
          body: await toCoverSuggestionsView(db, result, await this.business.today()),
        };
      },
    });
  }
}
