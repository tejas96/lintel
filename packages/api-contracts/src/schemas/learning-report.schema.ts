import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';
import { reportMeta } from './report.schema';

/**
 * The "learning from history" reports: estimate accuracy, rework rate and
 * recurring approval delays. Formulas: PRODUCT_REQUIREMENTS 13.6–13.8.
 */
const span = { start: calendarDateSchema, end: calendarDateSchema };
const whole = z.number().int();

const estimateTally = z.object({
  measured: whole,
  estimatedMinutes: whole,
  loggedMinutes: whole,
  /** Logged ÷ estimated over measured tasks; null when nothing was measured. */
  effortRatio: z.number().nullable(),
  within: whole,
  over: whole,
  under: whole,
  withinRate: z.number().nullable(),
  medianRatio: z.number().nullable(),
  notMeasured: whole,
  withoutEstimate: whole,
});

export const estimatesReportObject = reportMeta.extend({
  totals: estimateTally,
  byPeriod: z.array(estimateTally.extend(span)),
  byPerson: z.array(estimateTally.extend({ user: userSummarySchema, team: z.string().nullable() })),
  byTaskType: z.array(
    estimateTally.extend({
      /** Null for the tasks added by hand. */
      key: z.string().nullable(),
      name: z.string(),
      template: z.string().nullable(),
    }),
  ),
  byTemplate: z.array(
    estimateTally.extend({ template: z.object({ id: idSchema, name: z.string() }).nullable() }),
  ),
  /** Off: nobody can time work, so nothing is measured. */
  workTrackingEnabled: z.boolean(),
});
export type EstimatesReport = z.infer<typeof estimatesReportObject>;
export type EstimateTallyView = z.infer<typeof estimateTally>;
export const estimatesReportSchema: ResponseSchema<EstimatesReport> = estimatesReportObject;

const reworkTally = z.object({
  reviewed: whole,
  approved: whole,
  changesRequested: whole,
  rejected: whole,
  sentBack: whole,
  /** Sent back ÷ reviewed; null when nothing was reviewed. */
  reworkRate: z.number().nullable(),
});

export const reworkReportObject = reportMeta.extend({
  totals: reworkTally,
  byPeriod: z.array(reworkTally.extend(span)),
  byProject: z.array(reworkTally.extend({ project: projectRefSchema })),
  byPerson: z.array(reworkTally.extend({ user: userSummarySchema, team: z.string().nullable() })),
  /** The tasks (or deliverables without a task) sent back most, each pointing at its record. */
  mostSentBack: z.array(
    reworkTally.extend({
      kind: z.enum(['task', 'deliverable']),
      recordId: idSchema,
      title: z.string(),
      context: z.string().nullable(),
      project: projectRefSchema,
    }),
  ),
});
export type ReworkReport = z.infer<typeof reworkReportObject>;
export type ReworkTallyView = z.infer<typeof reworkTally>;
export const reworkReportSchema: ResponseSchema<ReworkReport> = reworkReportObject;

export const delayKindSchema = z.enum(['client_signoff', 'client_wait', 'internal_review']);
export type DelayKindView = z.infer<typeof delayKindSchema>;

const delaySummary = z.object({
  count: whole,
  delayed: whole,
  medianHours: z.number().nullable(),
  slowestHours: z.number().nullable(),
  waitingNow: whole,
  oldestWaitingHours: z.number().nullable(),
});

const delayGroup = {
  total: delaySummary,
  kinds: z.array(delaySummary.extend({ kind: delayKindSchema })),
  /** Three or more delayed approvals in the range. */
  recurring: z.boolean(),
};

export const delaysReportObject = reportMeta.extend({
  delayedAfterHours: z.number(),
  recurringAfter: whole,
  kinds: z.array(delaySummary.extend({ kind: delayKindSchema })),
  byClient: z.array(z.object({ client: z.string(), projects: whole, ...delayGroup })),
  byProject: z.array(z.object({ project: projectRefSchema, client: z.string(), ...delayGroup })),
  /** The longest waits that ended in the range, each pointing at its record. */
  slowest: z.array(
    z.object({
      kind: delayKindSchema,
      /** Milestone, task (client wait) or deliverable (internal review). */
      recordId: idSchema,
      project: projectRefSchema,
      title: z.string(),
      context: z.string().nullable(),
      readyAt: instantSchema,
      resolvedAt: instantSchema,
      hours: z.number(),
      delayed: z.boolean(),
    }),
  ),
});
export type DelaysReport = z.infer<typeof delaysReportObject>;
export type DelaySummaryView = z.infer<typeof delaySummary>;
export const delaysReportSchema: ResponseSchema<DelaysReport> = delaysReportObject;
