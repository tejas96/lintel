import type { RequestContext } from '@lintel/application';
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Ctx } from '../../common/auth/auth.decorators';
import { apiContract } from '../../contract';
import { ReportRunner } from './report-runner.service';

const routes = apiContract.reports;

/** Owner and manager reports as JSON. The CSV downloads are served by ReportExportController. */
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportRunner) {}

  @TsRestHandler(routes)
  handlers(@Ctx() context: RequestContext) {
    return tsRestHandler(routes, {
      deliveryReport: async ({ query }) => ({
        status: 200,
        body: await this.reports.delivery(context, query),
      }),
      workloadReport: async ({ query }) => ({
        status: 200,
        body: await this.reports.workload(context, query),
      }),
      leaveReport: async ({ query }) => ({
        status: 200,
        body: await this.reports.leave(context, query),
      }),
      approvalsReport: async ({ query }) => ({
        status: 200,
        body: await this.reports.approvals(context, query),
      }),
      estimatesReport: async ({ query }) => ({
        status: 200,
        body: await this.reports.estimates(context, query),
      }),
      reworkReport: async ({ query }) => ({
        status: 200,
        body: await this.reports.rework(context, query),
      }),
      delaysReport: async ({ query }) => ({
        status: 200,
        body: await this.reports.delays(context, query),
      }),
    });
  }
}
