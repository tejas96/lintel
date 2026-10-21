import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, versionSchema } from '../common/primitives';
import {
  leavePoliciesSchema,
  leaveRulesSchema,
  managedLeaveTypeSchema,
} from '../schemas/leave.schema';

const c = initContract();
const idParams = z.object({ id: idSchema });

/** Types are checked here; the ranges and their wording come from the domain rules. */
const leaveTypeDefinition = z.object({
  name: z.string().trim().max(200),
  description: z.string().trim().max(1000).nullable(),
  requiresReason: z.boolean(),
  allowsHalfDay: z.boolean(),
  minimumNoticeDays: z.number().int(),
  annualAllowanceHalfDays: z.number().int().nullable(),
  colorIndex: z.number().int(),
});

/**
 * Leave types and studio leave rules, for holders of `leave.manage_policies`.
 * Everyone reads the active types through `GET /leave/types`.
 */
export const leavePoliciesContract = c.router({
  getLeavePolicies: {
    method: 'GET',
    path: '/leave/policies',
    responses: { 200: leavePoliciesSchema },
    summary: 'Every leave type (retired ones included, with how often each is used) and the rules.',
  },
  createLeaveType: {
    method: 'POST',
    path: '/leave/policies/types',
    body: leaveTypeDefinition,
    responses: { 201: managedLeaveTypeSchema },
  },
  updateLeaveType: {
    method: 'PATCH',
    path: '/leave/policies/types/:id',
    pathParams: idParams,
    body: leaveTypeDefinition.partial().extend({ version: versionSchema }),
    responses: { 200: managedLeaveTypeSchema },
  },
  retireLeaveType: {
    method: 'POST',
    path: '/leave/policies/types/:id/retire',
    pathParams: idParams,
    body: z.object({ version: versionSchema }),
    responses: { 200: managedLeaveTypeSchema },
    summary: 'Existing requests keep the type; it can no longer be chosen for new ones.',
  },
  reactivateLeaveType: {
    method: 'POST',
    path: '/leave/policies/types/:id/reactivate',
    pathParams: idParams,
    body: z.object({ version: versionSchema }),
    responses: { 200: managedLeaveTypeSchema },
  },
  updateLeaveRules: {
    method: 'PUT',
    path: '/leave/policies/rules',
    body: z.object({ secondApprovalAboveHalfDays: z.number().int() }),
    responses: { 200: leaveRulesSchema },
    summary: 'Requests longer than this many half-days need a second approval.',
  },
});
