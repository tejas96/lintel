import { HEALTH_COMPONENTS, RISK_RULES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';
import { taskRefSchema, taskSummarySchema } from './task.schema';

const healthComponent = z.object({
  key: z.enum(HEALTH_COMPONENTS),
  weight: z.number(),
  penalty: z.number(),
  measure: z.number(),
  summary: z.string(),
});

export const businessHealthObject = z.object({
  formula: z.string(),
  score: z.number().int().min(0).max(100),
  band: z.enum(['healthy', 'watch', 'at_risk', 'critical']),
  components: z.array(healthComponent),
  /** Up to three parts that take the most points, each with the record that explains it. */
  contributors: z.array(
    healthComponent.extend({ link: z.object({ label: z.string(), linkPath: z.string() }) }),
  ),
  trend: z.object({
    scopeKey: z.string().nullable(),
    points: z.array(z.object({ date: calendarDateSchema, score: z.number().int() })),
    previousScore: z.number().int().nullable(),
    previousOn: calendarDateSchema.nullable(),
  }),
});

export const riskCardObject = z.object({
  key: z.string(),
  rule: z.enum(RISK_RULES),
  severity: z.enum(['risk', 'critical']),
  project: projectRefSchema,
  commitment: z.object({
    kind: z.enum(['milestone', 'delivery']),
    id: idSchema,
    name: z.string(),
    dueDate: calendarDateSchema,
  }),
  task: taskRefSchema.nullable(),
  /** Plain sentences; ISO dates inside are made readable by the apps. */
  happening: z.string(),
  impact: z.object({
    slipWorkingDays: z.number().int().min(0),
    forecastDate: calendarDateSchema.nullable(),
    summary: z.string(),
  }),
  /** Later commitments the same cause also delays. */
  alsoAffects: z.array(
    z.object({
      kind: z.enum(['milestone', 'delivery']),
      id: idSchema,
      name: z.string(),
      dueDate: calendarDateSchema,
      slipWorkingDays: z.number().int().min(0),
    }),
  ),
  nextAction: z.object({ label: z.string(), linkPath: z.string() }),
  responsible: z.object({
    role: z.enum(['task_owner', 'reviewer', 'project_manager', 'waiting_on']),
    user: userSummarySchema.nullable(),
  }),
  escalation: z
    .object({
      audience: z.enum(['reviewer', 'project_manager', 'business_owner']),
      at: instantSchema,
      alreadyHappened: z.boolean(),
      summary: z.string(),
    })
    .nullable(),
});
export type RiskCardItem = z.infer<typeof riskCardObject>;
export const riskCardSchema: ResponseSchema<RiskCardItem> = riskCardObject;

export const briefingObject = z.object({
  generatedAt: instantSchema,
  range: z.object({ start: calendarDateSchema, end: calendarDateSchema }),
  health: businessHealthObject,
  riskCards: z.array(riskCardSchema),
  riskCardCount: z.number().int(),
  deadlines: z.object({
    range: z.object({ start: calendarDateSchema, end: calendarDateSchema }),
    taskCount: z.number().int(),
    milestoneCount: z.number().int(),
    tasks: z.array(taskSummarySchema),
  }),
  highlights: z.array(
    z.object({
      user: userSummarySchema,
      milestones: z.array(
        z.object({
          id: idSchema,
          name: z.string(),
          dueDate: calendarDateSchema,
          completedOn: calendarDateSchema,
          project: projectRefSchema.nullable(),
        }),
      ),
    }),
  ),
  interventions: z.array(
    z.object({
      kind: z.enum(['overdue_escalated', 'blocker_escalated']),
      subjectId: idSchema,
      summary: z.string(),
      escalatedAt: instantSchema,
      linkPath: z.string(),
      task: taskRefSchema,
      project: projectRefSchema,
    }),
  ),
});
export type CommandCenterBriefing = z.infer<typeof briefingObject>;
export const briefingSchema: ResponseSchema<CommandCenterBriefing> = briefingObject;

export const projectRisksObject = z.object({
  generatedAt: instantSchema,
  cards: z.array(riskCardSchema),
  /** The planned delivery against the cards' forecast; null without open dated work. */
  delivery: z
    .object({
      dueDate: calendarDateSchema,
      forecastDate: calendarDateSchema,
      slipWorkingDays: z.number().int().min(0),
    })
    .nullable(),
});
export type ProjectRisks = z.infer<typeof projectRisksObject>;
export const projectRisksSchema: ResponseSchema<ProjectRisks> = projectRisksObject;

export const coverSuggestionsObject = z.object({
  leaveRequestId: idSchema,
  tasks: z.array(
    z.object({
      task: taskSummarySchema,
      window: z.object({ start: calendarDateSchema, end: calendarDateSchema }),
      remainingMinutes: z.number().int(),
      /** The share of the remaining effort planned on the days away. */
      needMinutes: z.number().int(),
      handover: z
        .object({
          id: idSchema,
          status: z.enum(['proposed', 'accepted', 'declined', 'applied']),
          to: userSummarySchema.nullable(),
          /** Applied, then given back to the person on leave: choose cover again. */
          handedBack: z.boolean(),
        })
        .nullable(),
      suggestions: z.array(
        z.object({
          user: userSummarySchema,
          score: z.number().int(),
          freeMinutes: z.number().int(),
          hasRoom: z.boolean(),
          reasons: z.array(z.string()),
        }),
      ),
    }),
  ),
});
export type CoverSuggestions = z.infer<typeof coverSuggestionsObject>;
export const coverSuggestionsSchema: ResponseSchema<CoverSuggestions> = coverSuggestionsObject;
