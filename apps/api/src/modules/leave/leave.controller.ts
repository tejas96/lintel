import {
  CancelLeaveRequestCommand,
  DecideHandoverCommand,
  DecideLeaveRequestCommands,
  LeaveQueries,
  RecordUrgentAbsenceCommand,
  type RequestContext,
  RequestLeaveCommands,
} from '@lintel/application';
import {
  type DatabaseConnection,
  listLeaveTypes,
  loadLeaveRequestDetail,
  queryLeaveRequests,
  toLeaveImpactView,
} from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { found, pageOf } from '../../common/http/access';
import { apiContract } from '../../contract';
import { DATABASE_CONNECTION } from '../../infrastructure/tokens';

const contract = apiContract.leave;

/** Leave requests, approvals, urgent absences and handovers. Rules live in the commands. */
@Controller()
export class LeaveController {
  constructor(
    private readonly requests: RequestLeaveCommands,
    private readonly decisions: DecideLeaveRequestCommands,
    private readonly cancellation: CancelLeaveRequestCommand,
    private readonly absences: RecordUrgentAbsenceCommand,
    private readonly handovers: DecideHandoverCommand,
    private readonly queries: LeaveQueries,
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
  ) {}

  /** The detail as the viewer may see it (404 when hidden). */
  private async detail(context: RequestContext, requestId: string) {
    const access = await this.queries.detail(context, requestId);
    return found(await loadLeaveRequestDetail(this.database.db, access), 'Leave request');
  }

  @TsRestHandler(contract)
  handlers(@Ctx() context: RequestContext) {
    const db = this.database.db;
    return tsRestHandler(contract, {
      listLeaveTypes: async () => ({
        status: 200,
        body: await listLeaveTypes(db, context.actor.capabilities.has('leave.manage_policies')),
      }),
      myLeaveBalances: async () => ({
        status: 200,
        body: await this.queries.balances(context),
      }),
      previewLeave: async ({ body }) => ({
        status: 200,
        body: await toLeaveImpactView(db, await this.requests.preview(context, body)),
      }),
      requestLeave: async ({ body }) => {
        const { id } = await this.requests.submit(context, body);
        return { status: 201, body: await this.detail(context, id) };
      },
      recordUrgentAbsence: async ({ body }) => {
        const { id } = await this.absences.execute(context, body);
        return { status: 201, body: await this.detail(context, id) };
      },
      listLeaveRequests: async ({ query }) => {
        const filter = await this.queries.listFilter(context, query.scope);
        const result = await queryLeaveRequests(db, { ...query, filter });
        return {
          status: 200,
          body: pageOf(result.items, query.page, query.pageSize, result.totalItems),
        };
      },
      getLeaveRequest: async ({ params }) => ({
        status: 200,
        body: await this.detail(context, params.id),
      }),
      decideLeaveRequest: async ({ params, body }) => {
        await this.decisions.decide(context, params.id, body);
        return { status: 200, body: await this.detail(context, params.id) };
      },
      respondToInfoRequest: async ({ params, body }) => {
        await this.decisions.respond(context, params.id, body);
        return { status: 200, body: await this.detail(context, params.id) };
      },
      cancelLeaveRequest: async ({ params, body }) => {
        await this.cancellation.execute(context, params.id, body);
        return { status: 200, body: await this.detail(context, params.id) };
      },
      decideHandover: async ({ params, body }) => {
        const { leaveRequestId } = await this.handovers.execute(context, params.id, body);
        return { status: 200, body: await this.detail(context, leaveRequestId) };
      },
    });
  }
}
