import { REASSIGNMENT_DECISIONS } from '@lintel/domain';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, noteSchema, versionSchema } from '../common/primitives';
import { reassignmentRequestSchema, taskReassignmentsSchema } from '../schemas/reassignment.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

/** Asking the project manager to give a task to someone else, and the decision. */
export const reassignmentsContract = c.router({
  listTaskReassignments: {
    method: 'GET',
    path: '/tasks/:id/reassignment-requests',
    pathParams: idParams,
    responses: { 200: taskReassignmentsSchema },
    summary: 'Requests on a task (open and decided) and what the viewer may do about them.',
  },
  requestReassignment: {
    method: 'POST',
    path: '/tasks/:id/reassignment-requests',
    pathParams: idParams,
    body: z.object({
      reason: noteSchema,
      suggestedUserId: idSchema.nullable(),
    }),
    responses: { 201: reassignmentRequestSchema },
    summary:
      'The task owner or a collaborator asks the project manager to reassign it. One open request per task.',
  },
  getReassignment: {
    method: 'GET',
    path: '/reassignment-requests/:id',
    pathParams: idParams,
    responses: { 200: reassignmentRequestSchema },
  },
  decideReassignment: {
    method: 'POST',
    path: '/reassignment-requests/:id/decision',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(REASSIGNMENT_DECISIONS),
      /** Who owns the task after acceptance; defaults to the suggested person. */
      newOwnerUserId: idSchema.nullable(),
      note: z.string().trim().max(2000).nullable(),
      version: versionSchema,
    }),
    responses: { 200: reassignmentRequestSchema },
    summary:
      'The project manager accepts (the task is reassigned, audited and the new owner notified) or declines with a note. Nobody decides their own request.',
  },
  withdrawReassignment: {
    method: 'POST',
    path: '/reassignment-requests/:id/withdraw',
    pathParams: idParams,
    body: z.object({ version: versionSchema }),
    responses: { 200: reassignmentRequestSchema },
  },
});
