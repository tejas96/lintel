import { REASSIGNMENT_STATUSES } from '@lintel/domain';
import { z } from 'zod';
import { idSchema, instantSchema, type ResponseSchema } from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';
import { taskRefSchema } from './task.schema';

export const reassignmentStatusSchema = z.enum(REASSIGNMENT_STATUSES);

export const reassignmentRequestObject = z.object({
  id: idSchema,
  task: taskRefSchema,
  project: projectRefSchema,
  status: reassignmentStatusSchema,
  reason: z.string(),
  requestedBy: userSummarySchema,
  ownerAtRequest: userSummarySchema.nullable(),
  suggested: userSummarySchema.nullable(),
  decidedBy: userSummarySchema.nullable(),
  decidedAt: instantSchema.nullable(),
  decisionNote: z.string().nullable(),
  newOwner: userSummarySchema.nullable(),
  createdAt: instantSchema,
  version: z.number().int(),
  /** The viewer manages the project and did not make this (open) request. */
  viewerCanDecide: z.boolean(),
  /** The viewer made this open request and may take it back. */
  viewerCanWithdraw: z.boolean(),
});
export type ReassignmentRequest = z.infer<typeof reassignmentRequestObject>;
export const reassignmentRequestSchema: ResponseSchema<ReassignmentRequest> =
  reassignmentRequestObject;

export const taskReassignmentsObject = z.object({
  requests: z.array(reassignmentRequestSchema),
  /** The viewer owns or works on the task and may ask for it to move. */
  viewerCanRequest: z.boolean(),
  /** Why not, when the viewer works on the task but cannot ask right now. */
  requestUnavailableReason: z.string().nullable(),
});
export type TaskReassignments = z.infer<typeof taskReassignmentsObject>;
export const taskReassignmentsSchema: ResponseSchema<TaskReassignments> = taskReassignmentsObject;
