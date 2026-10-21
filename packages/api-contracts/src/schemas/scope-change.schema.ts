import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  type ResponseSchema,
  shortTextSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { scopeChangeObject } from './project.schema';
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
