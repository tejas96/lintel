import { DATE_CHANGE_DECISIONS } from '@lintel/domain';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { calendarDateSchema, idSchema, noteSchema, versionSchema } from '../common/primitives';
import { dateChangeRequestSchema, taskDateChangesSchema } from '../schemas/date-change.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

/** Asking the project manager for new task dates, and the decision. */
export const dateChangesContract = c.router({
  listTaskDateChanges: {
    method: 'GET',
    path: '/tasks/:id/date-change-requests',
    pathParams: idParams,
    responses: { 200: taskDateChangesSchema },
    summary: 'New-date requests on a task and what the viewer may do about them.',
  },
  requestDateChange: {
    method: 'POST',
    path: '/tasks/:id/date-change-requests',
    pathParams: idParams,
    body: z.object({
      reason: noteSchema,
      proposedStartDate: calendarDateSchema.nullable(),
      proposedDueDate: calendarDateSchema,
    }),
    responses: { 201: dateChangeRequestSchema },
    summary:
      'The task owner or a collaborator asks the project manager for new dates, with a reason. One open request per task.',
  },
  getDateChange: {
    method: 'GET',
    path: '/date-change-requests/:id',
    pathParams: idParams,
    responses: { 200: dateChangeRequestSchema },
  },
  decideDateChange: {
    method: 'POST',
    path: '/date-change-requests/:id/decision',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(DATE_CHANGE_DECISIONS),
      note: z.string().trim().max(2000).nullable(),
      version: versionSchema,
    }),
    responses: { 200: dateChangeRequestSchema },
    summary:
      'The project manager accepts (the task moves, schedule history is kept, reminders re-plan) or declines with a note. Nobody decides their own request.',
  },
  withdrawDateChange: {
    method: 'POST',
    path: '/date-change-requests/:id/withdraw',
    pathParams: idParams,
    body: z.object({ version: versionSchema }),
    responses: { 200: dateChangeRequestSchema },
  },
});
