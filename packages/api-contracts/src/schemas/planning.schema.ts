import { GUIDANCE_TIP_KEYS } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  type ResponseSchema,
  shortTextSchema,
} from '../common/primitives';
import { projectRoleSchema } from './people.schema';
import { taskPrioritySchema, taskStatusSchema } from './task.schema';

/** A key inside a plan: a template key, or one the wizard made up for an added item. */
const planKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9_#-]*$/i, 'Use letters, numbers and dashes.');
const durationSchema = z.number().int().min(1).max(300);

/** A project manager's changes to a template before the project starts. */
export const planTailoringSchema = z.object({
  removedStageKeys: z.array(planKeySchema).max(50).default([]),
  removedTaskKeys: z.array(planKeySchema).max(300).default([]),
  addedStages: z
    .array(
      z.object({
        key: planKeySchema,
        name: shortTextSchema,
        afterStageKey: planKeySchema.nullable(),
      }),
    )
    .max(20)
    .default([]),
  addedTasks: z
    .array(
      z.object({
        key: planKeySchema,
        stageKey: planKeySchema,
        title: shortTextSchema,
        durationDays: durationSchema,
        dependsOn: z.array(planKeySchema).max(20).default([]),
        priority: taskPrioritySchema.default('medium'),
        responsibleRole: projectRoleSchema.default('member'),
      }),
    )
    .max(100)
    .default([]),
  adjustments: z
    .array(
      z.object({
        taskKey: planKeySchema,
        /** Start on this date instead of after the prerequisites. */
        startDate: calendarDateSchema.nullable().optional(),
        durationDays: durationSchema.nullable().optional(),
        /** Absent: whoever holds the role. Null: nobody yet. */
        ownerUserId: idSchema.nullable().optional(),
      }),
    )
    .max(300)
    .default([]),
});

export const planPreviewObject = z.object({
  plannedStartDate: calendarDateSchema,
  plannedEndDate: calendarDateSchema,
  /** Working days from the first to the last planned day, both included. */
  workingDays: z.number().int(),
  stages: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      isAdded: z.boolean(),
      plannedStartDate: calendarDateSchema,
      plannedEndDate: calendarDateSchema,
      milestones: z.array(
        z.object({ key: z.string(), name: z.string(), dueDate: calendarDateSchema }),
      ),
    }),
  ),
  tasks: z.array(
    z.object({
      key: z.string(),
      stageKey: z.string(),
      title: z.string(),
      isAdded: z.boolean(),
      plannedStartDate: calendarDateSchema,
      dueDate: calendarDateSchema,
      durationDays: z.number().int(),
      ownerUserId: idSchema.nullable(),
      responsibleRole: projectRoleSchema,
      priority: taskPrioritySchema,
      dependsOn: z.array(z.string()),
      milestoneKey: z.string().nullable(),
      startPinned: z.boolean(),
      overlapsPrerequisite: z.boolean(),
    }),
  ),
});
export type PlanPreview = z.infer<typeof planPreviewObject>;
export const planPreviewSchema: ResponseSchema<PlanPreview> = planPreviewObject;

/** New dates for one task bar, as dragged or set with the keyboard. */
export const taskDateChangeSchema = z.object({
  taskId: idSchema,
  plannedStartDate: calendarDateSchema,
  dueDate: calendarDateSchema,
});

export const reschedulePreviewObject = z.object({
  moves: z.array(
    z.object({
      taskId: idSchema,
      title: z.string(),
      status: taskStatusSchema,
      currentStartDate: calendarDateSchema.nullable(),
      currentDueDate: calendarDateSchema.nullable(),
      proposedStartDate: calendarDateSchema.nullable(),
      proposedDueDate: calendarDateSchema,
      shiftWorkingDays: z.number().int(),
      /** Moved because work it waits for moved. */
      isDownstream: z.boolean(),
      /** A committed deadline moves (the task is no longer a draft). */
      committed: z.boolean(),
    }),
  ),
  plannedEndDate: calendarDateSchema,
  forecastEndDate: calendarDateSchema.nullable(),
  projectEndImpactDays: z.number().int(),
  /** The agreed end date would move: it has to be proposed as a scope change. */
  requiresScopeChange: z.boolean(),
  /** A committed deadline moves, so a reason is needed. */
  needsReason: z.boolean(),
  slippingMilestones: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      dueDate: calendarDateSchema,
      latestTaskDueDate: calendarDateSchema,
    }),
  ),
});
export type ReschedulePreview = z.infer<typeof reschedulePreviewObject>;
export const reschedulePreviewSchema: ResponseSchema<ReschedulePreview> = reschedulePreviewObject;

export const guidanceTipKeySchema = z.enum(GUIDANCE_TIP_KEYS);

export const guidanceObject = z.object({
  audience: z.enum(['member', 'manager', 'owner']),
  tips: z.array(
    z.object({ key: guidanceTipKeySchema, title: z.string(), body: z.string(), seen: z.boolean() }),
  ),
});
export type Guidance = z.infer<typeof guidanceObject>;
export const guidanceSchema: ResponseSchema<Guidance> = guidanceObject;
