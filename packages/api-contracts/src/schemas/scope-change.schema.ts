import { PROJECT_COST_CATEGORIES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  moneyMinorSchema,
  type ResponseSchema,
  shortTextSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { taskDateChangeSchema } from './planning.schema';
import { clientSignOffMethodSchema, scopeChangeObject } from './project.schema';
import { taskPrioritySchema, taskRefSchema, taskStatusSchema } from './task.schema';

/** A task a scope change proposes to add (request body and preview echo). */
export const scopeNewTaskInputSchema = z.object({
  title: shortTextSchema,
  stageId: idSchema.nullable(),
  plannedStartDate: calendarDateSchema.nullable(),
  dueDate: calendarDateSchema.nullable(),
  ownerUserId: idSchema.nullable(),
  priority: taskPrioritySchema,
});

const taskShiftSchema = z.object({
  taskId: idSchema,
  shiftWorkingDays: z.number().int().min(-60).max(120),
});

/** Moves, additions and cancellations; at least one of them must be present. */
export const scopeChangeRequestSchema = z.object({
  taskShifts: z.array(taskShiftSchema).max(100).default([]),
  /** Exact new dates (dragged on the timeline); not together with taskShifts. */
  taskDateChanges: z.array(taskDateChangeSchema).max(20).default([]),
  newTasks: z.array(scopeNewTaskInputSchema).max(30).default([]),
  cancelTaskIds: z.array(idSchema).max(100).default([]),
});

export const scopeNewTaskObject = z.object({
  id: idSchema,
  title: z.string(),
  stage: z.object({ id: idSchema, name: z.string() }).nullable(),
  plannedStartDate: calendarDateSchema.nullable(),
  dueDate: calendarDateSchema.nullable(),
  owner: userSummarySchema.nullable(),
  priority: taskPrioritySchema,
  /** The task approval created; null while proposed or when rejected. */
  createdTask: taskRefSchema.nullable(),
});

export const scopeCancellationObject = z.object({
  id: idSchema,
  task: taskRefSchema,
  statusAtProposal: taskStatusSchema,
  outcome: z.enum(['pending', 'cancelled', 'skipped']),
  skipReason: z.string().nullable(),
});

export const scopeChangeDetailObject = scopeChangeObject.extend({
  newTasks: z.array(scopeNewTaskObject),
  cancellations: z.array(scopeCancellationObject),
});
export type ScopeChangeDetail = z.infer<typeof scopeChangeDetailObject>;
export const scopeChangeDetailSchema: ResponseSchema<ScopeChangeDetail> = scopeChangeDetailObject;

export const scopeChangePreviewObject = scopeChangeObject
  .pick({ impacts: true, projectEndImpactDays: true })
  .extend({
    newTasks: z.array(scopeNewTaskInputSchema),
    cancellations: z.array(z.object({ taskId: idSchema, taskTitle: z.string() })),
  });
export type ScopeChangePreview = z.infer<typeof scopeChangePreviewObject>;
export const scopeChangePreviewSchema: ResponseSchema<ScopeChangePreview> =
  scopeChangePreviewObject;

/** The money side of a proposal; only people who can see the budget may send it. */
export const scopeChangeTermsSchema = z.object({
  /** Approval waits until the client's sign-off is recorded. */
  requiresClientSignOff: z.boolean().default(false),
  /** What the extra work costs the studio, in minor units (above zero). */
  costImpactMinor: moneyMinorSchema.positive().nullable().default(null),
  costCategory: z.enum(PROJECT_COST_CATEGORIES).nullable().default(null),
  /** What the client pays more (negative: less), in minor units. */
  feeImpactMinor: moneyMinorSchema.nullable().default(null),
});

export const clientSignOffBodySchema = z.object({
  confirmedByName: shortTextSchema,
  method: clientSignOffMethodSchema,
  confirmedOn: calendarDateSchema,
  note: z.string().trim().max(1000).nullable(),
});
