import { TASK_PRIORITIES, TASK_STATUSES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  type ResponseSchema,
  timeOfDaySchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export const blockerCategorySchema = z.enum([
  'client',
  'supplier',
  'internal_dependency',
  'manager_decision',
  'information',
  'other',
]);

export const taskRefObject = z.object({
  id: idSchema,
  number: z.number().int(),
  title: z.string(),
  status: taskStatusSchema,
  dueDate: calendarDateSchema.nullable(),
});
export type TaskRef = z.infer<typeof taskRefObject>;
export const taskRefSchema: ResponseSchema<TaskRef> = taskRefObject;

export const taskSummaryObject = taskRefObject.extend({
  /** "HH:mm" in the studio's timezone; null means the end of the working day. */
  dueTime: timeOfDaySchema.nullable(),
  priority: taskPrioritySchema,
  project: projectRefSchema,
  stage: z.object({ id: idSchema, name: z.string() }).nullable(),
  milestone: z.object({ id: idSchema, name: z.string(), dueDate: calendarDateSchema }).nullable(),
  owner: userSummarySchema.nullable(),
  reviewer: userSummarySchema.nullable(),
  plannedStartDate: calendarDateSchema.nullable(),
  estimateMinutes: z.number().int().nullable(),
  checklist: z.object({
    done: z.number().int(),
    total: z.number().int(),
    requiredRemaining: z.number().int(),
  }),
  isOverdue: z.boolean(),
  hasOpenBlocker: z.boolean(),
  requiresReview: z.boolean(),
  needsAcknowledgement: z.boolean(),
  version: z.number().int(),
});
export type TaskSummary = z.infer<typeof taskSummaryObject>;
export const taskSummarySchema: ResponseSchema<TaskSummary> = taskSummaryObject;

export const checklistItemObject = z.object({
  id: idSchema,
  label: z.string(),
  isRequired: z.boolean(),
  position: z.number().int(),
  completedAt: instantSchema.nullable(),
  completedBy: userSummarySchema.nullable(),
});
export type ChecklistItem = z.infer<typeof checklistItemObject>;
export const checklistItemSchema: ResponseSchema<ChecklistItem> = checklistItemObject;

export const blockerObject = z.object({
  id: idSchema,
  taskId: idSchema,
  category: blockerCategorySchema,
  reason: z.string(),
  waitingOn: userSummarySchema.nullable(),
  raisedBy: userSummarySchema,
  raisedAt: instantSchema,
  resolvedAt: instantSchema.nullable(),
  resolvedBy: userSummarySchema.nullable(),
  resolution: z.string().nullable(),
});
export type Blocker = z.infer<typeof blockerObject>;
export const blockerSchema: ResponseSchema<Blocker> = blockerObject;

export const blockerWithTaskObject = blockerObject.extend({ task: taskSummarySchema });
export type BlockerWithTask = z.infer<typeof blockerWithTaskObject>;
export const blockerWithTaskSchema: ResponseSchema<BlockerWithTask> = blockerWithTaskObject;

export const transitionOptionObject = z.object({
  to: taskStatusSchema,
  label: z.string(),
  allowed: z.boolean(),
  requiresNote: z.boolean(),
  reasons: z.array(z.string()),
});
export type TransitionOption = z.infer<typeof transitionOptionObject>;
export const transitionOptionSchema: ResponseSchema<TransitionOption> = transitionOptionObject;

export const fileSummaryObject = z.object({
  id: idSchema,
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  isImage: z.boolean(),
  uploadedBy: userSummarySchema,
  createdAt: instantSchema,
});
export type FileSummary = z.infer<typeof fileSummaryObject>;
export const fileSummarySchema: ResponseSchema<FileSummary> = fileSummaryObject;

export const scheduleChangeSchema = z.object({
  id: idSchema,
  previousDueDate: calendarDateSchema.nullable(),
  newDueDate: calendarDateSchema.nullable(),
  previousDueTime: timeOfDaySchema.nullable(),
  newDueTime: timeOfDaySchema.nullable(),
  reason: z.string(),
  changedBy: userSummarySchema,
  createdAt: instantSchema,
});

export const taskCommentObject = z.object({
  id: idSchema,
  author: userSummarySchema,
  body: z.string(),
  createdAt: instantSchema,
  editedAt: instantSchema.nullable(),
});
export type TaskComment = z.infer<typeof taskCommentObject>;
export const taskCommentSchema: ResponseSchema<TaskComment> = taskCommentObject;

export const taskDetailObject = taskSummaryObject.extend({
  description: z.string().nullable(),
  completionCriteria: z.string().nullable(),
  baselineDueDate: calendarDateSchema.nullable(),
  actualMinutes: z.number().int(),
  acknowledgedAt: instantSchema.nullable(),
  startedAt: instantSchema.nullable(),
  completedAt: instantSchema.nullable(),
  parentTask: taskRefSchema.nullable(),
  subtasks: z.array(taskRefSchema),
  collaborators: z.array(userSummarySchema),
  checklistItems: z.array(checklistItemSchema),
  prerequisites: z.array(taskRefSchema),
  dependents: z.array(taskRefSchema),
  blockers: z.array(blockerSchema),
  attachments: z.array(fileSummarySchema),
  scheduleChanges: z.array(scheduleChangeSchema),
  activeWorkSessionStartedAt: instantSchema.nullable(),
  transitions: z.array(transitionOptionSchema),
  viewerCanManage: z.boolean(),
  viewerCanEdit: z.boolean(),
  /** Working days overdue before the project manager is alerted. */
  escalateAfterOverdueDays: z.number().int(),
  /** False when the studio does not track working time: no start or pause controls. */
  workTrackingEnabled: z.boolean(),
});
export type TaskDetail = z.infer<typeof taskDetailObject>;
export const taskDetailSchema: ResponseSchema<TaskDetail> = taskDetailObject;

export const workQueueItemObject = z.object({
  task: taskSummarySchema,
  score: z.number(),
  bucket: z.enum(['overdue', 'today', 'upcoming', 'later', 'blocked', 'waiting', 'in_review']),
  headline: z.string(),
  reasons: z.array(z.object({ code: z.string(), points: z.number(), explanation: z.string() })),
});
export type WorkQueueItem = z.infer<typeof workQueueItemObject>;
export const workQueueItemSchema: ResponseSchema<WorkQueueItem> = workQueueItemObject;

export const workQueueObject = z.object({
  today: calendarDateSchema,
  next: workQueueItemSchema.nullable(),
  items: z.array(workQueueItemSchema),
  counts: z.object({
    overdue: z.number().int(),
    today: z.number().int(),
    upcoming: z.number().int(),
    blocked: z.number().int(),
    waiting: z.number().int(),
    inReview: z.number().int(),
    needsAcknowledgement: z.number().int(),
  }),
  workload: z.object({
    availableMinutesToday: z.number().int(),
    committedMinutesToday: z.number().int(),
    status: z.enum(['available', 'balanced', 'stretched', 'overloaded']),
    onLeaveToday: z.boolean(),
  }),
  reviewsWaitingForMe: z.array(taskSummarySchema),
  recentlyCompleted: z.array(taskSummarySchema),
  strategy: z.string(),
  /** False when the studio does not track working time: no start or pause controls. */
  workTrackingEnabled: z.boolean(),
});
export type WorkQueue = z.infer<typeof workQueueObject>;
export const workQueueSchema: ResponseSchema<WorkQueue> = workQueueObject;
