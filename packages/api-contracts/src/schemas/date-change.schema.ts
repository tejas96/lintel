import { DATE_CHANGE_STATUSES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';
import { taskRefSchema } from './task.schema';

export const dateChangeStatusSchema = z.enum(DATE_CHANGE_STATUSES);

export const dateChangeRequestObject = z.object({
  id: idSchema,
  task: taskRefSchema,
  project: projectRefSchema,
  status: dateChangeStatusSchema,
  reason: z.string(),
  previousStartDate: calendarDateSchema.nullable(),
  previousDueDate: calendarDateSchema.nullable(),
  proposedStartDate: calendarDateSchema.nullable(),
  proposedDueDate: calendarDateSchema,
  requestedBy: userSummarySchema,
  decidedBy: userSummarySchema.nullable(),
  decidedAt: instantSchema.nullable(),
  decisionNote: z.string().nullable(),
  createdAt: instantSchema,
  version: z.number().int(),
  /** The viewer manages the project and did not make this (open) request. */
  viewerCanDecide: z.boolean(),
  /** The viewer made this open request and may take it back. */
  viewerCanWithdraw: z.boolean(),
});
export type DateChangeRequest = z.infer<typeof dateChangeRequestObject>;
export const dateChangeRequestSchema: ResponseSchema<DateChangeRequest> = dateChangeRequestObject;

export const taskDateChangesObject = z.object({
  requests: z.array(dateChangeRequestSchema),
  /** The viewer owns or works on the task and may ask for a new date. */
  viewerCanRequest: z.boolean(),
  /** Why not, when the viewer works on the task but cannot ask right now. */
  requestUnavailableReason: z.string().nullable(),
});
export type TaskDateChanges = z.infer<typeof taskDateChangesObject>;
export const taskDateChangesSchema: ResponseSchema<TaskDateChanges> = taskDateChangesObject;
