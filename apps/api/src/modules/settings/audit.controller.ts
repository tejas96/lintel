import type { RequestContext } from '@lintel/application';
import { type DatabaseConnection, queryAuditLog } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { pageOf, requireCapability } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const { listAuditLog } = apiContract.operations;

/** Compensation fields audited on reward decisions; hidden without `rewards.view_all`. */
const COMPENSATION_FIELDS = ['amountMinor', 'adjustedAmountMinor', 'adjustmentReason', 'note'];

function withoutCompensation(
  values: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!values) return values;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      COMPENSATION_FIELDS.includes(key) ? '[restricted]' : value,
    ]),
  );
}

/** The audit trail (`audit.view`). Other operations routes live in their own modules. */
@Controller()
export class AuditController {
  constructor(@Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection) {}

  @TsRestHandler(listAuditLog)
  listAuditLog(@Ctx() context: RequestContext) {
    return tsRestHandler(listAuditLog, async ({ query }) => {
      requireCapability(context, 'audit.view');
      const result = await queryAuditLog(this.database.db, query);
      const seesCompensation = context.actor.capabilities.has('rewards.view_all');
      const items = result.items.map((item) =>
        seesCompensation || !item.action.startsWith('rewards.')
          ? item
          : {
              ...item,
              before: withoutCompensation(item.before),
              after: withoutCompensation(item.after),
            },
      );
      return {
        status: 200,
        body: pageOf(items, query.page, query.pageSize, result.totalItems),
      };
    });
  }
}
