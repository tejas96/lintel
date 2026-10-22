import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { calendarDateSchema, idSchema } from '../common/primitives';
import {
  delaysReportSchema,
  estimatesReportSchema,
  reworkReportSchema,
} from '../schemas/learning-report.schema';
import {
  approvalsReportSchema,
  deliveryReportSchema,
  leaveReportSchema,
  workloadReportSchema,
} from '../schemas/report.schema';

const c = initContract();

/** Every report takes the same filters. The range defaults to the last 90 days. */
export const reportQuerySchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  projectId: idSchema.optional(),
  managerUserId: idSchema.optional(),
  teamId: idSchema.optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const REPORT_NAMES = [
  'delivery',
  'workload',
  'leave',
  'approvals',
  'estimates',
  'rework',
  'delays',
] as const;
export type ReportName = (typeof REPORT_NAMES)[number];
export const reportNameSchema = z.enum(REPORT_NAMES);

/**
 * CSV downloads are plain routes outside this contract (the body is a file):
 * GET /v1/reports/:report/csv with the same query, UTF-8 with a BOM, served
 * as an attachment. Same access rules as the JSON report.
 */
export function reportCsvPath(report: ReportName): string {
  return `/v1/reports/${report}/csv`;
}

const access =
  ' Owners and administrators (`dashboard.view_business`) see the studio; project managers see their own projects.';

export const reportsContract = c.router({
  deliveryReport: {
    method: 'GET',
    path: '/reports/delivery',
    query: reportQuerySchema,
    responses: { 200: deliveryReportSchema },
    summary: `On-time and late tasks and milestones per project, person and period.${access}`,
  },
  workloadReport: {
    method: 'GET',
    path: '/reports/workload',
    query: reportQuerySchema,
    responses: { 200: workloadReportSchema },
    summary: `Planned, logged and available hours per person and team.${access}`,
  },
  leaveReport: {
    method: 'GET',
    path: '/reports/leave',
    query: reportQuerySchema,
    responses: { 200: leaveReportSchema },
    summary: `Approved leave days by person and leave type.${access}`,
  },
  approvalsReport: {
    method: 'GET',
    path: '/reports/approvals',
    query: reportQuerySchema,
    responses: { 200: approvalsReportSchema },
    summary: `Turnaround of deliverable reviews, leave decisions, scope changes, new-date and handover requests.${access}`,
  },
  estimatesReport: {
    method: 'GET',
    path: '/reports/estimates',
    query: reportQuerySchema,
    responses: { 200: estimatesReportSchema },
    summary: `Estimated against logged effort of finished tasks, per person, task type and template.${access}`,
  },
  reworkReport: {
    method: 'GET',
    path: '/reports/rework',
    query: reportQuerySchema,
    responses: { 200: reworkReportSchema },
    summary: `Deliverable versions sent back after review, per task, person and project.${access}`,
  },
  delaysReport: {
    method: 'GET',
    path: '/reports/delays',
    query: reportQuerySchema,
    responses: { 200: delaysReportSchema },
    summary: `Client sign-offs, client waits and internal reviews that took longer than 48 hours, by client and project.${access}`,
  },
});
