import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../common/pagination';
import { calendarDateSchema, idSchema, noteSchema, versionSchema } from '../common/primitives';
import {
  dayPortionSchema,
  leaveBalanceSchema,
  leaveImpactSchema,
  leaveRequestDetailSchema,
  leaveRequestSchema,
  leaveStatusSchema,
  leaveTypeSchema,
  peopleAwaySchema,
} from '../schemas/leave.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

export const leavePeriodSchema = z.object({
  leaveTypeId: idSchema,
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  dayPortion: dayPortionSchema,
});

const handoverInput = z.array(
  z.object({
    taskId: idSchema,
    toUserId: idSchema.nullable(),
    note: z.string().max(1000).nullable(),
  }),
);

export const leaveContract = c.router({
  listLeaveTypes: {
    method: 'GET',
    path: '/leave/types',
    responses: { 200: z.array(leaveTypeSchema) },
  },
  myLeaveBalances: {
    method: 'GET',
    path: '/leave/balances',
    responses: { 200: z.array(leaveBalanceSchema) },
  },
  previewLeave: {
    method: 'POST',
    path: '/leave/preview',
    body: leavePeriodSchema.extend({
      userId: idSchema.nullable(),
      reason: z.string().max(1000).nullable(),
    }),
    responses: { 200: leaveImpactSchema },
    summary: 'Working days, affected work, team overlap and policy warnings — before submitting.',
  },
  requestLeave: {
    method: 'POST',
    path: '/leave/requests',
    body: leavePeriodSchema.extend({
      reason: z.string().trim().max(1000).nullable(),
      handovers: handoverInput,
    }),
    responses: { 201: leaveRequestDetailSchema },
  },
  recordUrgentAbsence: {
    method: 'POST',
    path: '/leave/urgent-absences',
    body: leavePeriodSchema.extend({ userId: idSchema, reason: noteSchema }),
    responses: { 201: leaveRequestDetailSchema },
    summary:
      'A manager records an unplanned absence; affected work is reassessed, never silently reassigned.',
  },
  listLeaveRequests: {
    method: 'GET',
    path: '/leave/requests',
    query: pageQuerySchema.extend({
      scope: z.enum(['mine', 'to_decide', 'team', 'all']).default('mine'),
      status: z.enum(['open', 'all', ...leaveStatusSchema.options]).default('all'),
      from: calendarDateSchema.optional(),
      to: calendarDateSchema.optional(),
    }),
    responses: { 200: pageSchema(leaveRequestSchema) },
  },
  getLeaveRequest: {
    method: 'GET',
    path: '/leave/requests/:id',
    pathParams: idParams,
    responses: { 200: leaveRequestDetailSchema },
  },
  decideLeaveRequest: {
    method: 'POST',
    path: '/leave/requests/:id/decision',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(['approve', 'reject', 'request_info']),
      note: z.string().trim().max(1000).nullable(),
      version: versionSchema,
    }),
    responses: { 200: leaveRequestDetailSchema },
  },
  respondToInfoRequest: {
    method: 'POST',
    path: '/leave/requests/:id/respond',
    pathParams: idParams,
    body: z.object({ reason: noteSchema, handovers: handoverInput, version: versionSchema }),
    responses: { 200: leaveRequestDetailSchema },
  },
  cancelLeaveRequest: {
    method: 'POST',
    path: '/leave/requests/:id/cancel',
    pathParams: idParams,
    body: z.object({ note: z.string().trim().max(1000).nullable(), version: versionSchema }),
    responses: { 200: leaveRequestDetailSchema },
  },
  decideHandover: {
    method: 'POST',
    path: '/leave/handovers/:id/decision',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(['accept', 'decline', 'apply']),
      toUserId: idSchema.nullable(),
    }),
    responses: { 200: leaveRequestDetailSchema },
    summary:
      'Accept or decline a proposed handover; a manager applies it (reassigns the task, audited).',
  },
  peopleAwayDuringTask: {
    method: 'GET',
    path: '/leave/away-during-task/:id',
    pathParams: idParams,
    responses: { 200: peopleAwaySchema },
    summary:
      'Who is on leave (or has asked for it) while the task runs, for warnings when changing its owner. Dates only.',
  },
});
