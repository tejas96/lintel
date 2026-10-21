import { type ReportName, reportNameSchema, reportQuerySchema } from '@lintel/api-contracts';
import type { RequestContext } from '@lintel/application';
import { NotFoundError, ValidationFailedError } from '@lintel/shared';
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Ctx } from '../../common/auth/auth.decorators';
import { contentDisposition } from '../deliverables/file-content.controller';
import { encodeCsv } from './csv-encoder';
import { delaysCsv, estimatesCsv, reworkCsv } from './learning-report-csv';
import { approvalsCsv, type CsvTable, deliveryCsv, leaveCsv, workloadCsv } from './report-csv';
import { ReportRunner } from './report-runner.service';

const TITLES: Readonly<Record<ReportName, string>> = {
  delivery: 'delivery-reliability',
  workload: 'workload-and-capacity',
  leave: 'leave-taken',
  approvals: 'approvals-turnaround',
  estimates: 'estimate-accuracy',
  rework: 'rework-rate',
  delays: 'approval-delays',
};

/**
 * GET /v1/reports/:report/csv — the report as a spreadsheet download.
 *
 * Its own single-route controller because it writes the response itself
 * (`@Res()`), which must never sit in a multi-route ts-rest handler. Same
 * query and the same access rules as the JSON report; the global session
 * guard applies (GET needs no CSRF header). UTF-8 with a BOM, CRLF lines,
 * cells safe against formula injection, served as an attachment.
 */
@Controller('v1/reports')
export class ReportExportController {
  constructor(private readonly reports: ReportRunner) {}

  @Get(':report/csv')
  async download(
    @Ctx() context: RequestContext,
    @Param('report') report: string,
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ): Promise<void> {
    const name = reportNameSchema.safeParse(report);
    if (!name.success) throw new NotFoundError('Report');
    const filters = reportQuerySchema.safeParse(query);
    if (!filters.success) {
      throw new ValidationFailedError(
        'Check the report filters.',
        filters.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    const { table, range } = await this.tableFor(context, name.data, filters.data);
    const body = encodeCsv(table.header, table.rows);
    response.status(200);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      contentDisposition(`lintel-${TITLES[name.data]}-${range.start}-to-${range.end}.csv`, false),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(Buffer.from(body, 'utf8'));
  }

  private async tableFor(
    context: RequestContext,
    report: ReportName,
    query: Parameters<ReportRunner['delivery']>[1],
  ): Promise<{ table: CsvTable; range: { start: string; end: string } }> {
    switch (report) {
      case 'delivery': {
        const view = await this.reports.delivery(context, query);
        return { table: deliveryCsv(view), range: view.range };
      }
      case 'workload': {
        const view = await this.reports.workload(context, query);
        return { table: workloadCsv(view), range: view.range };
      }
      case 'leave': {
        const view = await this.reports.leave(context, query);
        return { table: leaveCsv(view), range: view.range };
      }
      case 'approvals': {
        const view = await this.reports.approvals(context, query);
        return { table: approvalsCsv(view, await this.reports.timeZone()), range: view.range };
      }
      case 'estimates': {
        const view = await this.reports.estimates(context, query);
        return { table: estimatesCsv(view), range: view.range };
      }
      case 'rework': {
        const view = await this.reports.rework(context, query);
        return { table: reworkCsv(view), range: view.range };
      }
      case 'delays': {
        const view = await this.reports.delays(context, query);
        return { table: delaysCsv(view, await this.reports.timeZone()), range: view.range };
      }
    }
  }
}
