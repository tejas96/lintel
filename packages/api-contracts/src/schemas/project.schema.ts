import {
  CLIENT_SIGN_OFF_METHODS,
  PROJECT_COST_CATEGORIES,
  PROJECT_CRITICALITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  moneyMinorSchema,
  type ResponseSchema,
} from '../common/primitives';
import { projectRoleSchema, userSummarySchema } from './people.schema';

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const projectTypeSchema = z.enum(PROJECT_TYPES);
export const projectCriticalitySchema = z.enum(PROJECT_CRITICALITIES);
export const clientSignOffMethodSchema = z.enum(CLIENT_SIGN_OFF_METHODS);
const costCategorySchema = z.enum(PROJECT_COST_CATEGORIES);
export const healthStatusSchema = z.enum([
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'closed',
]);

export const projectHealthObject = z.object({
  status: healthStatusSchema,
  reasons: z.array(z.object({ severity: z.enum(['risk', 'critical']), message: z.string() })),
  openTaskCount: z.number().int(),
  overdueTaskCount: z.number().int(),
  blockedTaskCount: z.number().int(),
  completedTaskCount: z.number().int(),
  forecastEndDate: calendarDateSchema.nullable(),
});
export type ProjectHealthView = z.infer<typeof projectHealthObject>;
export const projectHealthSchema: ResponseSchema<ProjectHealthView> = projectHealthObject;

export const projectRefObject = z.object({
  id: idSchema,
  reference: z.string(),
  name: z.string(),
  colorIndex: z.number().int(),
});
export type ProjectRef = z.infer<typeof projectRefObject>;
export const projectRefSchema: ResponseSchema<ProjectRef> = projectRefObject;

export const projectSummaryObject = projectRefObject.extend({
  clientName: z.string(),
  projectType: projectTypeSchema,
  status: projectStatusSchema,
  criticality: projectCriticalitySchema,
  manager: userSummarySchema,
  plannedStartDate: calendarDateSchema,
  plannedEndDate: calendarDateSchema,
  baselineEndDate: calendarDateSchema,
  health: projectHealthSchema,
  currentStage: z
    .object({
      id: idSchema,
      name: z.string(),
      position: z.number().int(),
      totalStages: z.number().int(),
    })
    .nullable(),
  nextMilestone: z
    .object({ id: idSchema, name: z.string(), dueDate: calendarDateSchema })
    .nullable(),
});
export type ProjectSummary = z.infer<typeof projectSummaryObject>;
export const projectSummarySchema: ResponseSchema<ProjectSummary> = projectSummaryObject;

export const stageObject = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  status: z.enum(['pending', 'active', 'completed', 'skipped']),
  plannedStartDate: calendarDateSchema.nullable(),
  plannedEndDate: calendarDateSchema.nullable(),
  taskCounts: z.object({
    total: z.number().int(),
    done: z.number().int(),
    blocked: z.number().int(),
  }),
});
export type Stage = z.infer<typeof stageObject>;
export const stageSchema: ResponseSchema<Stage> = stageObject;

export const milestoneObject = z.object({
  id: idSchema,
  stageId: idSchema.nullable(),
  name: z.string(),
  dueDate: calendarDateSchema,
  baselineDueDate: calendarDateSchema,
  status: z.enum(['pending', 'completed', 'cancelled']),
  health: z.enum(['completed', 'on_track', 'at_risk', 'missed']),
  riskReasons: z.array(z.string()),
  requiresClientApproval: z.boolean(),
  openTaskCount: z.number().int(),
  completedAt: instantSchema.nullable(),
  version: z.number().int(),
});
export type Milestone = z.infer<typeof milestoneObject>;
export const milestoneSchema: ResponseSchema<Milestone> = milestoneObject;

export const projectMemberObject = z.object({
  user: userSummarySchema,
  projectRole: projectRoleSchema,
});
export type ProjectMember = z.infer<typeof projectMemberObject>;
export const projectMemberSchema: ResponseSchema<ProjectMember> = projectMemberObject;

export const projectDetailObject = projectSummaryObject.extend({
  description: z.string().nullable(),
  siteAddress: z.string().nullable(),
  clientPhone: z.string().nullable(),
  clientEmail: z.string().nullable(),
  owner: userSummarySchema,
  members: z.array(projectMemberSchema),
  stages: z.array(stageSchema),
  milestones: z.array(milestoneSchema),
  /** Present only for people allowed to see project finances. */
  budgetMinor: z.number().int().nullable(),
  /** The viewer may see the budget, costs and the money side of scope changes. */
  viewerCanSeeFinances: z.boolean(),
  currency: z.string(),
  template: z
    .object({ id: idSchema, name: z.string(), versionNumber: z.number().int() })
    .nullable(),
  templateOptions: z.array(z.string()),
  viewerCanManage: z.boolean(),
  createdAt: instantSchema,
  version: z.number().int(),
});
export type ProjectDetail = z.infer<typeof projectDetailObject>;
export const projectDetailSchema: ResponseSchema<ProjectDetail> = projectDetailObject;

export const activityItemObject = z.object({
  id: idSchema,
  type: z.string(),
  summary: z.string(),
  actor: userSummarySchema.nullable(),
  project: projectRefSchema.nullable(),
  taskId: idSchema.nullable(),
  createdAt: instantSchema,
});
export type ActivityItem = z.infer<typeof activityItemObject>;
export const activityItemSchema: ResponseSchema<ActivityItem> = activityItemObject;

export const scopeChangeObject = z.object({
  id: idSchema,
  projectId: idSchema,
  title: z.string(),
  description: z.string(),
  status: z.enum(['proposed', 'approved', 'rejected', 'withdrawn']),
  requestedBy: userSummarySchema,
  decidedBy: userSummarySchema.nullable(),
  decidedAt: instantSchema.nullable(),
  decisionNote: z.string().nullable(),
  impacts: z.array(
    z.object({
      taskId: idSchema,
      taskTitle: z.string(),
      currentDueDate: calendarDateSchema.nullable(),
      proposedDueDate: calendarDateSchema.nullable(),
      currentStartDate: calendarDateSchema.nullable(),
      proposedStartDate: calendarDateSchema.nullable(),
      shiftWorkingDays: z.number().int(),
      isDownstream: z.boolean(),
      /** Approval sets these exact dates (dragged on the timeline) instead of shifting. */
      appliesExactDates: z.boolean(),
    }),
  ),
  projectEndImpactDays: z.number().int(),
  /** Approval waits for the client's recorded sign-off. */
  requiresClientSignOff: z.boolean(),
  /** How the client confirmed it, newest first; the first one counts. */
  clientSignOffs: z.array(
    z.object({
      id: idSchema,
      confirmedByName: z.string(),
      method: clientSignOffMethodSchema,
      confirmedOn: calendarDateSchema,
      note: z.string().nullable(),
      recordedBy: userSummarySchema.nullable(),
      recordedAt: instantSchema,
    }),
  ),
  /** The money side; null when the viewer may not see the project budget. */
  money: z
    .object({
      /** What the extra work costs the studio, in minor units; recorded on approval. */
      costImpactMinor: moneyMinorSchema.nullable(),
      costCategory: costCategorySchema.nullable(),
      /** What the client pays more (negative: less); added to the budget on approval. */
      feeImpactMinor: moneyMinorSchema.nullable(),
    })
    .nullable(),
  createdAt: instantSchema,
  version: z.number().int(),
});
export type ScopeChange = z.infer<typeof scopeChangeObject>;
export const scopeChangeSchema: ResponseSchema<ScopeChange> = scopeChangeObject;
