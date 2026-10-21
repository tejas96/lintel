import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  type ResponseSchema,
} from '../common/primitives';
import { loadStatusSchema } from './capacity.schema';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';

const span = { start: calendarDateSchema, end: calendarDateSchema };

const reportMeta = z.object({
  generatedAt: instantSchema,
  /** business = the whole studio; managed = only the viewer's own projects. */
  scope: z.enum(['business', 'managed']),
  range: z.object(span),
  granularity: z.enum(['week', 'month']),
});

const deliveryTally = z.object({
  onTime: z.number().int(),
  late: z.number().int(),
  openOverdue: z.number().int(),
  onTimeRate: z.number().nullable(),
  averageDaysLate: z.number().nullable(),
});
const deliveryPair = z.object({ tasks: deliveryTally, milestones: deliveryTally });

export const deliveryReportObject = reportMeta.extend({
  totals: deliveryPair,
  byPeriod: z.array(deliveryPair.extend(span)),
  byProject: z.array(
    deliveryPair.extend({ project: projectRefSchema, manager: userSummarySchema }),
  ),
  byPerson: z.array(
    z.object({ user: userSummarySchema, team: z.string().nullable(), tasks: deliveryTally }),
  ),
});
export type DeliveryReport = z.infer<typeof deliveryReportObject>;
export type DeliveryTallyView = z.infer<typeof deliveryTally>;
export const deliveryReportSchema: ResponseSchema<DeliveryReport> = deliveryReportObject;

const workloadSummary = z.object({
  availableMinutes: z.number().int(),
  plannedMinutes: z.number().int(),
  tentativeMinutes: z.number().int(),
  loggedMinutes: z.number().int(),
  utilization: z.number().nullable(),
  status: loadStatusSchema,
});

export const workloadReportObject = reportMeta.extend({
  totals: workloadSummary,
  byPeriod: z.array(workloadSummary.extend(span)),
  byPerson: z.array(
    workloadSummary.extend({
      user: userSummarySchema,
      team: z.string().nullable(),
      scheduledTasks: z.number().int(),
      tasksWithoutEstimate: z.number().int(),
      leaveDays: z.number(),
    }),
  ),
  byTeam: z.array(
    workloadSummary.extend({
      team: z.object({ id: idSchema, name: z.string() }).nullable(),
      people: z.number().int(),
    }),
  ),
  defaultEstimateMinutes: z.number().int(),
  workTrackingEnabled: z.boolean(),
  /** False when limited to some projects: then only their tasks and logged time count. */
  coversAllProjects: z.boolean(),
});
export type WorkloadReport = z.infer<typeof workloadReportObject>;
export type WorkloadSummaryView = z.infer<typeof workloadSummary>;
export const workloadReportSchema: ResponseSchema<WorkloadReport> = workloadReportObject;

const leaveTotals = {
  requests: z.number().int(),
  days: z.number(),
  upcomingDays: z.number(),
};

export const leaveReportObject = reportMeta.extend({
  totals: z.object(leaveTotals),
  types: z.array(
    z.object({ id: idSchema, name: z.string(), colorIndex: z.number().int(), ...leaveTotals }),
  ),
  byPerson: z.array(
    z.object({
      user: userSummarySchema,
      team: z.string().nullable(),
      ...leaveTotals,
      byType: z.array(z.object({ typeId: idSchema, ...leaveTotals })),
    }),
  ),
});
export type LeaveReport = z.infer<typeof leaveReportObject>;
export const leaveReportSchema: ResponseSchema<LeaveReport> = leaveReportObject;

export const approvalKindSchema = z.enum(['deliverable_review', 'leave_decision', 'scope_change']);

export const approvalsReportObject = reportMeta.extend({
  kinds: z.array(
    z.object({
      kind: approvalKindSchema,
      decided: z.number().int(),
      medianHours: z.number().nullable(),
      slowestHours: z.number().nullable(),
      waiting: z.number().int(),
      oldestWaitingHours: z.number().nullable(),
    }),
  ),
  byDecider: z.array(
    z.object({
      kind: approvalKindSchema,
      decider: userSummarySchema,
      decided: z.number().int(),
      medianHours: z.number().nullable(),
      slowestHours: z.number().nullable(),
    }),
  ),
  /** The slowest decisions of the range, each pointing at its record. */
  slowest: z.array(
    z.object({
      kind: approvalKindSchema,
      recordId: idSchema,
      projectId: idSchema.nullable(),
      title: z.string(),
      context: z.string().nullable(),
      requestedAt: instantSchema,
      decidedAt: instantSchema,
      hours: z.number(),
      decider: userSummarySchema.nullable(),
    }),
  ),
});
export type ApprovalsReport = z.infer<typeof approvalsReportObject>;
export const approvalsReportSchema: ResponseSchema<ApprovalsReport> = approvalsReportObject;
