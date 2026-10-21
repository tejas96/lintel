import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, versionSchema } from '../common/primitives';
import {
  planPreviewSchema,
  planTailoringSchema,
  reschedulePreviewSchema,
  taskDateChangeSchema,
} from '../schemas/planning.schema';
import { clientSignOffBodySchema, scopeChangeDetailSchema } from '../schemas/scope-change.schema';
import { createProjectBodySchema } from './projects.contract';

const c = initContract();

const idParams = z.object({ id: idSchema });

/** Planning before and during a project: plan preview, timeline rescheduling, client sign-off. */
export const planningContract = c.router({
  previewProjectPlan: {
    method: 'POST',
    path: '/projects/plan-preview',
    body: createProjectBodySchema
      .pick({
        managerUserId: true,
        plannedStartDate: true,
        templateVersionId: true,
        templateOptions: true,
        members: true,
      })
      .extend({ tailoring: planTailoringSchema.optional() }),
    responses: { 200: planPreviewSchema },
    summary:
      'The dated plan a new project would get from a template and its tailoring, with its end date. Nothing is saved.',
  },
  previewReschedule: {
    method: 'POST',
    path: '/projects/:id/reschedule/preview',
    pathParams: idParams,
    body: z.object({ changes: z.array(taskDateChangeSchema).min(1).max(20) }),
    responses: { 200: reschedulePreviewSchema },
    summary:
      'What new dates for task bars would move: the tasks waiting on them, milestones and the end date. Project managers only.',
  },
  rescheduleTasks: {
    method: 'POST',
    path: '/projects/:id/reschedule',
    pathParams: idParams,
    body: z.object({
      changes: z.array(taskDateChangeSchema).min(1).max(20),
      /** Required when a committed deadline moves; kept in each task's history. */
      reason: z.string().trim().max(500).nullable(),
      expectedVersions: z
        .array(z.object({ taskId: idSchema, version: versionSchema }))
        .max(20)
        .default([]),
    }),
    responses: { 200: z.object({ moved: z.number().int() }) },
    summary:
      'Apply new dates and their knock-on. Refused when the agreed end date would move (propose a scope change instead).',
  },
  recordClientSignOff: {
    method: 'POST',
    path: '/scope-changes/:id/client-sign-offs',
    pathParams: idParams,
    body: clientSignOffBodySchema,
    responses: { 201: scopeChangeDetailSchema },
    summary:
      'Record who at the client confirmed a proposed scope change, when and how. Earlier records stay as history.',
  },
});
