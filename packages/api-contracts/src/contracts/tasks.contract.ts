import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../common/pagination';
import {
  calendarDateSchema,
  emptyBodySchema,
  idSchema,
  longTextSchema,
  noteSchema,
  shortTextSchema,
  timeOfDaySchema,
  versionSchema,
} from '../common/primitives';
import {
  blockerCategorySchema,
  blockerSchema,
  taskCommentSchema,
  taskDetailSchema,
  taskPrioritySchema,
  taskStatusSchema,
  taskSummarySchema,
} from '../schemas/task.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

export const createTaskBodySchema = z.object({
  projectId: idSchema,
  stageId: idSchema.nullable(),
  milestoneId: idSchema.nullable(),
  parentTaskId: idSchema.nullable(),
  title: shortTextSchema,
  description: longTextSchema.nullable(),
  priority: taskPrioritySchema,
  ownerUserId: idSchema.nullable(),
  reviewerUserId: idSchema.nullable(),
  collaboratorUserIds: z.array(idSchema).max(20),
  plannedStartDate: calendarDateSchema.nullable(),
  dueDate: calendarDateSchema.nullable(),
  /** Optional time of day it is due ("HH:mm", studio timezone); needs a due date. */
  dueTime: timeOfDaySchema.nullable().default(null),
  estimateMinutes: z.number().int().min(0).max(100_000).nullable(),
  requiresReview: z.boolean(),
  completionCriteria: z.string().max(2000).nullable(),
  checklist: z.array(z.object({ label: shortTextSchema, isRequired: z.boolean() })).max(50),
  /** Created as "ready" when an owner and due date are set; otherwise as a draft. */
  publish: z.boolean(),
});
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;

export const tasksContract = c.router({
  listTasks: {
    method: 'GET',
    path: '/tasks',
    query: pageQuerySchema.extend({
      projectId: idSchema.optional(),
      ownerUserId: idSchema.optional(),
      status: z.enum(['open', 'all', ...taskStatusSchema.options]).default('open'),
      dueBefore: calendarDateSchema.optional(),
      dueAfter: calendarDateSchema.optional(),
      search: z.string().trim().max(100).optional(),
      sort: z.enum(['dueDate', 'priority', 'number', 'updatedAt']).default('dueDate'),
    }),
    responses: { 200: pageSchema(taskSummarySchema) },
  },
  createTask: {
    method: 'POST',
    path: '/tasks',
    body: createTaskBodySchema,
    responses: { 201: taskDetailSchema },
  },
  getTask: {
    method: 'GET',
    path: '/tasks/:id',
    pathParams: idParams,
    responses: { 200: taskDetailSchema },
    summary:
      'Task detail, including the status changes the viewer may make and why others are blocked.',
  },
  updateTask: {
    method: 'PATCH',
    path: '/tasks/:id',
    pathParams: idParams,
    body: z
      .object({
        title: shortTextSchema,
        description: longTextSchema.nullable(),
        priority: taskPrioritySchema,
        reviewerUserId: idSchema.nullable(),
        plannedStartDate: calendarDateSchema.nullable(),
        dueDate: calendarDateSchema.nullable(),
        dueTime: timeOfDaySchema.nullable(),
        estimateMinutes: z.number().int().min(0).max(100_000).nullable(),
        requiresReview: z.boolean(),
        completionCriteria: z.string().max(2000).nullable(),
        milestoneId: idSchema.nullable(),
        stageId: idSchema.nullable(),
        /** Working days overdue before the project manager is alerted (manager only). */
        escalateAfterOverdueDays: z.number().int().min(1).max(30),
      })
      .partial()
      .extend({
        version: versionSchema,
        /** Required when a committed due date or time moves; kept in the schedule history. */
        scheduleChangeReason: z.string().trim().min(3).max(500).optional(),
      }),
    responses: { 200: taskDetailSchema },
  },
  transitionTask: {
    method: 'POST',
    path: '/tasks/:id/transition',
    pathParams: idParams,
    body: z.object({
      to: taskStatusSchema,
      note: z.string().trim().max(2000).nullable(),
      version: versionSchema,
    }),
    responses: { 200: taskDetailSchema },
    summary: 'Change status. Rules are checked on the server and every refusal is explained.',
  },
  assignTask: {
    method: 'POST',
    path: '/tasks/:id/assign',
    pathParams: idParams,
    body: z.object({
      ownerUserId: idSchema,
      reason: z.string().trim().max(500).nullable(),
      version: versionSchema,
    }),
    responses: { 200: taskDetailSchema },
    summary: 'Set or change the accountable owner. Reassignments are audited.',
  },
  setCollaborators: {
    method: 'PUT',
    path: '/tasks/:id/collaborators',
    pathParams: idParams,
    body: z.object({ userIds: z.array(idSchema).max(20) }),
    responses: { 200: taskDetailSchema },
  },
  acknowledgeTask: {
    method: 'POST',
    path: '/tasks/:id/acknowledge',
    pathParams: idParams,
    body: emptyBodySchema,
    responses: { 200: taskDetailSchema },
  },
  addDependency: {
    method: 'POST',
    path: '/tasks/:id/dependencies',
    pathParams: idParams,
    body: z.object({ dependsOnTaskId: idSchema }),
    responses: { 200: taskDetailSchema },
    summary: 'Add a prerequisite. Loops are refused.',
  },
  removeDependency: {
    method: 'DELETE',
    path: '/tasks/:id/dependencies/:dependsOnTaskId',
    pathParams: z.object({ id: idSchema, dependsOnTaskId: idSchema }),
    body: c.noBody(),
    responses: { 200: taskDetailSchema },
  },
  addChecklistItem: {
    method: 'POST',
    path: '/tasks/:id/checklist',
    pathParams: idParams,
    body: z.object({ label: shortTextSchema, isRequired: z.boolean() }),
    responses: { 200: taskDetailSchema },
  },
  toggleChecklistItem: {
    method: 'POST',
    path: '/checklist-items/:id/toggle',
    pathParams: idParams,
    body: z.object({ completed: z.boolean() }),
    responses: { 200: taskDetailSchema },
  },
  removeChecklistItem: {
    method: 'DELETE',
    path: '/checklist-items/:id',
    pathParams: idParams,
    body: c.noBody(),
    responses: { 200: taskDetailSchema },
  },
  reportBlocker: {
    method: 'POST',
    path: '/tasks/:id/blockers',
    pathParams: idParams,
    body: z.object({
      category: blockerCategorySchema,
      reason: noteSchema,
      waitingOnUserId: idSchema.nullable(),
      version: versionSchema,
    }),
    responses: { 200: taskDetailSchema },
    summary: 'Block the task and say what it waits on. Managers are notified.',
  },
  resolveBlocker: {
    method: 'POST',
    path: '/blockers/:id/resolve',
    pathParams: idParams,
    body: z.object({ resolution: noteSchema, resumeWork: z.boolean() }),
    responses: { 200: taskDetailSchema },
  },
  listOpenBlockers: {
    method: 'GET',
    path: '/blockers',
    query: z.object({ projectId: idSchema.optional() }),
    responses: { 200: z.array(blockerSchema) },
  },
  listComments: {
    method: 'GET',
    path: '/tasks/:id/comments',
    pathParams: idParams,
    responses: { 200: z.array(taskCommentSchema) },
  },
  addComment: {
    method: 'POST',
    path: '/tasks/:id/comments',
    pathParams: idParams,
    body: z.object({ body: z.string().trim().min(1).max(5000) }),
    responses: { 201: taskCommentSchema },
  },
});
