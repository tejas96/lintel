import type { RequestContext } from '@lintel/application';
import { type DatabaseConnection, queryAuditLog } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { pageOf, requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const { listAuditLog } = apiContract.operations;

/** The audit trail (`audit.view`). Other operations routes live in their own modules. */
@Controller()
export class AuditController {
  constructor(@Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection) {}

  @TsRestHandler(listAuditLog)
  listAuditLog(@Ctx() context: RequestContext) {
    return tsRestHandler(listAuditLog, async ({ query }) => {
      requireCapability(context, 'audit.view');
      const result = await queryAuditLog(this.database.db, query);
      return {
        status: 200,
        body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
      };
    });
  }
}
