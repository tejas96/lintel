import type { RequestContext } from '@lintel/application';
import { type DatabaseConnection, loadApprovalQueue } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const { myApprovalQueue } = apiContract.deliverables;

/** Everything waiting for the signed-in person's decision, across modules. */
@Controller()
export class ApprovalsController {
  constructor(
    private readonly business: BusinessContextService,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  @TsRestHandler(myApprovalQueue)
  myApprovalQueue(@Ctx() context: RequestContext) {
    return tsRestHandler(myApprovalQueue, async () => ({
      status: 200,
      body: await loadApprovalQueue(
        this.database.db,
        { userId: context.actor.userId, capabilities: context.actor.capabilities },
        await this.business.today(),
      ),
    }));
  }
}
