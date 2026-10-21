import { DAY_PORTIONS, LEAVE_STATUSES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { taskRefSchema } from './task.schema';

export const leaveStatusSchema = z.enum(LEAVE_STATUSES);
export const dayPortionSchema = z.enum(DAY_PORTIONS);

export const leaveTypeObject = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  requiresReason: z.boolean(),
  allowsHalfDay: z.boolean(),
  minimumNoticeDays: z.number().int(),
  annualAllowanceHalfDays: z.number().int().nullable(),
  colorIndex: z.number().int(),
  isActive: z.boolean(),
  version: z.number().int(),
});
export type LeaveType = z.infer<typeof leaveTypeObject>;
export const leaveTypeSchema: ResponseSchema<LeaveType> = leaveTypeObject;

export const leaveConflictObject = z.object({
  taskId: idSchema,
  title: z.string(),
  projectName: z.string(),
  kind: z.enum(['due_during_leave', 'work_during_leave', 'milestone_during_leave']),
  severity: z.enum(['critical', 'warning']),
  explanation: z.string(),
});
export type LeaveConflict = z.infer<typeof leaveConflictObject>;
export const leaveConflictSchema: ResponseSchema<LeaveConflict> = leaveConflictObject;

export const leaveImpactObject = z.object({
  days: z.array(z.object({ date: calendarDateSchema, halfDayUnits: z.number().int() })),
  halfDayUnits: z.number().int(),
  durationLabel: z.string(),
  conflicts: z.array(leaveConflictSchema),
  overlappingAbsences: z.array(
    z.object({ user: userSummarySchema, status: z.string(), dates: z.array(calendarDateSchema) }),
  ),
  warnings: z.array(z.string()),
  blockingProblems: z.array(z.string()),
  approvalLevels: z.number().int(),
});
export type LeaveImpact = z.infer<typeof leaveImpactObject>;
export const leaveImpactSchema: ResponseSchema<LeaveImpact> = leaveImpactObject;

export const leaveHandoverObject = z.object({
  id: idSchema,
  task: taskRefSchema,
  to: userSummarySchema.nullable(),
  note: z.string().nullable(),
  status: z.enum(['proposed', 'accepted', 'declined', 'applied']),
});
export type LeaveHandover = z.infer<typeof leaveHandoverObject>;
export const leaveHandoverSchema: ResponseSchema<LeaveHandover> = leaveHandoverObject;

export const leaveRequestObject = z.object({
  id: idSchema,
  user: userSummarySchema,
  leaveType: leaveTypeObject.pick({ id: true, code: true, name: true, colorIndex: true }),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  dayPortion: dayPortionSchema,
  halfDayUnits: z.number().int(),
  durationLabel: z.string(),
  reason: z.string().nullable(),
  status: leaveStatusSchema,
  isUrgentAbsence: z.boolean(),
  warnings: z.array(z.string()),
  steps: z.array(
    z.object({
      level: z.number().int(),
      approver: userSummarySchema.nullable(),
      status: z.enum(['waiting', 'pending', 'approved', 'rejected', 'skipped']),
      note: z.string().nullable(),
      decidedAt: instantSchema.nullable(),
    }),
  ),
  decisionNote: z.string().nullable(),
  createdAt: instantSchema,
  version: z.number().int(),
});
export type LeaveRequest = z.infer<typeof leaveRequestObject>;
export const leaveRequestSchema: ResponseSchema<LeaveRequest> = leaveRequestObject;

export const leaveRequestDetailObject = leaveRequestObject.extend({
  impact: leaveImpactSchema,
  handovers: z.array(leaveHandoverSchema),
  viewerCanDecide: z.boolean(),
  viewerCanCancel: z.boolean(),
});
export type LeaveRequestDetail = z.infer<typeof leaveRequestDetailObject>;
export const leaveRequestDetailSchema: ResponseSchema<LeaveRequestDetail> =
  leaveRequestDetailObject;

export const leaveBalanceObject = z.object({
  leaveType: leaveTypeObject.pick({ id: true, code: true, name: true, colorIndex: true }),
  allowanceHalfDays: z.number().int().nullable(),
  usedHalfDays: z.number().int(),
  pendingHalfDays: z.number().int(),
});
export type LeaveBalance = z.infer<typeof leaveBalanceObject>;
export const leaveBalanceSchema: ResponseSchema<LeaveBalance> = leaveBalanceObject;

export const managedLeaveTypeObject = leaveTypeObject.extend({
  /** Requests ever made with this type (all statuses). */
  requestCount: z.number().int(),
  /** Requests still waiting for a decision or more information. */
  openRequestCount: z.number().int(),
});
export type ManagedLeaveType = z.infer<typeof managedLeaveTypeObject>;
export const managedLeaveTypeSchema: ResponseSchema<ManagedLeaveType> = managedLeaveTypeObject;

export const leaveRulesObject = z.object({ secondApprovalAboveHalfDays: z.number().int() });
export type LeaveRules = z.infer<typeof leaveRulesObject>;
export const leaveRulesSchema: ResponseSchema<LeaveRules> = leaveRulesObject;

export const leavePoliciesObject = z.object({
  rules: leaveRulesObject,
  types: z.array(managedLeaveTypeObject),
});
export type LeavePolicies = z.infer<typeof leavePoliciesObject>;
export const leavePoliciesSchema: ResponseSchema<LeavePolicies> = leavePoliciesObject;
