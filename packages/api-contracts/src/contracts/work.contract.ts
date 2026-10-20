import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { emptyBodySchema, idSchema, noteSchema } from '../common/primitives';
import { taskDetailSchema, workQueueSchema } from '../schemas/task.schema';

const c = initContract();
const idParams = z.object({ id: idSchema });

/** The signed-in person's day: prioritised queue, work sessions and priority conflicts. */
export const workContract = c.router({
  myWorkQueue: {
    method: 'GET',
    path: '/me/work-queue',
    responses: { 200: workQueueSchema },
    summary:
      'The signed-in person’s prioritised work for today, with the reason for each position.',
  },
  startWork: {
    method: 'POST',
    path: '/tasks/:id/work/start',
    pathParams: idParams,
    body: emptyBodySchema,
    responses: { 200: taskDetailSchema },
    summary: 'Start a work session (and the task, if it is ready). One active session per person.',
  },
  pauseWork: {
    method: 'POST',
    path: '/tasks/:id/work/pause',
    pathParams: idParams,
    body: emptyBodySchema,
    responses: { 200: taskDetailSchema },
  },
  raisePriorityConflict: {
    method: 'POST',
    path: '/me/priority-conflicts',
    body: z.object({ taskIds: z.array(idSchema).min(2).max(10), note: noteSchema }),
    responses: { 201: z.object({ id: idSchema }) },
    summary: 'Tell managers that two or more commitments cannot both be met.',
  },
  resolvePriorityConflict: {
    method: 'POST',
    path: '/priority-conflicts/:id/resolve',
    pathParams: idParams,
    body: z.object({ resolution: noteSchema }),
    responses: { 200: z.object({ id: idSchema }) },
  },
});
