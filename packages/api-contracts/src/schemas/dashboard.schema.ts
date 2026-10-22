import { z } from 'zod';
import {
  calendarDateSchema,
  instantSchema,
  moneyMinorSchema,
  type ResponseSchema,
} from '../common/primitives';
import { approvalItemSchema } from './deliverable.schema';
import { portfolioProfitabilitySchema } from './finance.schema';
import { leaveRequestSchema } from './leave.schema';
import { userSummarySchema } from './people.schema';
import {
  milestoneSchema,
  projectRefSchema,
  projectSummarySchema,
  scopeChangeSchema,
} from './project.schema';
import { blockerWithTaskSchema, taskSummarySchema } from './task.schema';

const kpi = z.object({
  value: z.number(),
  /** Change against the previous period of the same length, when computable. */
  previousValue: z.number().nullable(),
  sampleSize: z.number().int().nullable(),
});

export const commandCenterObject = z.object({
  generatedAt: instantSchema,
  range: z.object({ start: calendarDateSchema, end: calendarDateSchema }),
  kpis: z.object({
    activeProjects: kpi,
    projectsAtRisk: kpi,
    projectsOffTrack: kpi,
    overdueTasks: kpi,
    blockedTasks: kpi,
    dueToday: kpi,
    pendingApprovals: kpi,
    /** Completed on or before the effective due date ÷ completed, in the range. */
    onTimeDeliveryRate: kpi,
  }),
  projectsNeedingAttention: z.array(projectSummarySchema),
  upcomingMilestones: z.array(z.object({ milestone: milestoneSchema, project: projectRefSchema })),
  criticalToday: z.array(taskSummarySchema),
  blockers: z.array(blockerWithTaskSchema),
  approvals: z.array(approvalItemSchema),
  team: z.object({
    headcount: z.number().int(),
    availableToday: z.number().int(),
    onLeaveToday: z.array(userSummarySchema),
    /** Booked past 105% this week, or past the available time on any day of it. */
    overloaded: z.array(
      z.object({
        user: userSummarySchema,
        utilization: z.number(),
        overloadedDays: z.number().int(),
      }),
    ),
  }),
  leaveAwaitingDecision: z.array(leaveRequestSchema),
  scopeChangesAwaitingDecision: z.array(scopeChangeSchema),
  deliveryTrend: z.array(
    z.object({ weekStart: calendarDateSchema, onTime: z.number().int(), late: z.number().int() }),
  ),
  rewards: z
    .object({
      pendingReview: z.number().int(),
      approvedThisMonthMinor: moneyMinorSchema.nullable(),
      currency: z.string(),
    })
    .nullable(),
  /** Only when profitability is switched on, over the projects whose budgets the viewer may see. */
  profitability: portfolioProfitabilitySchema.nullable(),
});
export type CommandCenter = z.infer<typeof commandCenterObject>;
export const commandCenterSchema: ResponseSchema<CommandCenter> = commandCenterObject;
