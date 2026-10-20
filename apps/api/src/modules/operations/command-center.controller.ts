import { CapacityQuery, planCommandCenter, type RequestContext } from '@lintel/application';
import { type DatabaseConnection, loadCommandCenter, managesAnyProject } from '@lintel/database';
import { type Clock, toCalendarDate } from '@lintel/shared';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, DATABASE_CONNECTION } from '../../infrastructure/tokens';

const { capacity, commandCenter } = apiContract.operations;

/** Workload, availability and the business command center. */
@Controller()
export class CommandCenterController {
  constructor(
    private readonly capacityQuery: CapacityQuery,
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @TsRestHandler(capacity)
  capacity(@Ctx() context: RequestContext) {
    return tsRestHandler(capacity, async ({ query }) => ({
      status: 200,
      body: await this.capacityQuery.execute(context, query),
    }));
  }

  @TsRestHandler(commandCenter)
  commandCenter(@Ctx() context: RequestContext) {
    return tsRestHandler(commandCenter, async ({ query }) => {
      const db = this.database.db;
      const [today, settings, manages] = await Promise.all([
        this.business.today(),
        this.business.settings(),
        managesAnyProject(db, context.actor.userId),
      ]);
      const plan = planCommandCenter(context.actor, query, today, manages);
      const body = await loadCommandCenter(db, plan, {
        timeZone: settings.timeZone,
        currency: settings.currency,
        viewerCapabilities: context.actor.capabilities,
        now: this.clock.now(),
        utilisation: (userIds, span) =>
          this.capacityQuery.rowsForUsers(userIds, {
            start: toCalendarDate(span.start),
            end: toCalendarDate(span.end),
          }),
      });
      return { status: 200, body };
    });
  }
}
