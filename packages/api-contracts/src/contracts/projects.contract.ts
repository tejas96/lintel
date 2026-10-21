import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../common/pagination';
import {
  calendarDateSchema,
  idSchema,
  longTextSchema,
  noteSchema,
  shortTextSchema,
  versionSchema,
} from '../common/primitives';
import { projectRoleSchema } from '../schemas/people.schema';
import { planTailoringSchema } from '../schemas/planning.schema';
import {
  activityItemSchema,
  healthStatusSchema,
  projectCriticalitySchema,
  projectDetailSchema,
  projectStatusSchema,
  projectSummarySchema,
  projectTypeSchema,
} from '../schemas/project.schema';
import {
  scopeChangeDetailSchema,
  scopeChangePreviewSchema,
  scopeChangeRequestSchema,
  scopeChangeTermsSchema,
} from '../schemas/scope-change.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

export const createProjectBodySchema = z.object({
  name: shortTextSchema,
  clientName: shortTextSchema,
  clientPhone: z.string().trim().max(30).nullable(),
  clientEmail: z.string().email().nullable(),
  siteAddress: z.string().trim().max(500).nullable(),
  projectType: projectTypeSchema,
  description: longTextSchema.nullable(),
  criticality: projectCriticalitySchema,
  managerUserId: idSchema,
  plannedStartDate: calendarDateSchema,
  templateVersionId: idSchema.nullable(),
  templateOptions: z.array(z.string()).max(20),
  /** Who does the work for each project role; tasks are assigned from this. */
  members: z.array(z.object({ userId: idSchema, projectRole: projectRoleSchema })).max(50),
  budgetMinor: z.number().int().min(0).nullable(),
  /** Changes to the template's plan before the project starts (stages, tasks, dates, people). */
  tailoring: planTailoringSchema.optional(),
});
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

export const projectsContract = c.router({
  listProjects: {
    method: 'GET',
    path: '/projects',
    query: pageQuerySchema.extend({
      search: z.string().trim().max(100).optional(),
      status: z.enum(['open', 'all', ...projectStatusSchema.options]).default('open'),
      health: healthStatusSchema.optional(),
      managerUserId: idSchema.optional(),
      projectType: projectTypeSchema.optional(),
      sort: z.enum(['name', 'plannedEndDate', 'health', 'createdAt']).default('plannedEndDate'),
      direction: z.enum(['asc', 'desc']).default('asc'),
    }),
    responses: { 200: pageSchema(projectSummarySchema) },
    summary: 'Projects the viewer may see, with health and progress.',
  },
  createProject: {
    method: 'POST',
    path: '/projects',
    body: createProjectBodySchema,
    responses: { 201: projectDetailSchema },
    summary: 'Create a project and, when a template is chosen, its dated workflow.',
  },
  getProject: {
    method: 'GET',
    path: '/projects/:id',
    pathParams: idParams,
    responses: { 200: projectDetailSchema },
  },
  updateProject: {
    method: 'PATCH',
    path: '/projects/:id',
    pathParams: idParams,
    body: createProjectBodySchema
      .pick({
        name: true,
        clientName: true,
        clientPhone: true,
        clientEmail: true,
        siteAddress: true,
        description: true,
        criticality: true,
        managerUserId: true,
        budgetMinor: true,
      })
      .partial()
      .extend({ version: versionSchema }),
    responses: { 200: projectDetailSchema },
  },
  changeProjectStatus: {
    method: 'POST',
    path: '/projects/:id/status',
    pathParams: idParams,
    body: z.object({
      status: projectStatusSchema,
      note: noteSchema.nullable(),
      version: versionSchema,
    }),
    responses: { 200: projectDetailSchema },
  },
  setProjectMembers: {
    method: 'PUT',
    path: '/projects/:id/members',
    pathParams: idParams,
    body: z.object({
      members: z.array(z.object({ userId: idSchema, projectRole: projectRoleSchema })).max(50),
    }),
    responses: { 200: projectDetailSchema },
  },
  completeMilestone: {
    method: 'POST',
    path: '/milestones/:id/complete',
    pathParams: idParams,
    body: z.object({ note: z.string().max(2000).nullable(), version: versionSchema }),
    responses: { 200: projectDetailSchema },
    summary: 'Mark a milestone complete. All its tasks must be done or cancelled.',
  },
  listProjectActivity: {
    method: 'GET',
    path: '/projects/:id/activity',
    pathParams: idParams,
    query: pageQuerySchema,
    responses: { 200: pageSchema(activityItemSchema) },
  },
  listScopeChanges: {
    method: 'GET',
    path: '/projects/:id/scope-changes',
    pathParams: idParams,
    responses: { 200: z.array(scopeChangeDetailSchema) },
  },
  previewScopeChange: {
    method: 'POST',
    path: '/projects/:id/scope-changes/preview',
    pathParams: idParams,
    body: scopeChangeRequestSchema,
    responses: { 200: scopeChangePreviewSchema },
    summary:
      'Show which tasks and dates a proposed change would move, add or cancel, and its effect on the end date, without saving it.',
  },
  proposeScopeChange: {
    method: 'POST',
    path: '/projects/:id/scope-changes',
    pathParams: idParams,
    body: scopeChangeRequestSchema.merge(scopeChangeTermsSchema).extend({
      title: shortTextSchema,
      description: noteSchema,
    }),
    responses: { 201: scopeChangeDetailSchema },
    summary:
      'Propose a scope change. A cost or fee may be added only by people who can see the budget; with client sign-off required, approval waits for it.',
  },
  decideScopeChange: {
    method: 'POST',
    path: '/scope-changes/:id/decision',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(['approved', 'rejected']),
      note: noteSchema,
      version: versionSchema,
    }),
    responses: { 200: scopeChangeDetailSchema },
    summary:
      'Approve (applies the new dates, creates added tasks, cancels removed ones, records the cost and fee, keeping the history) or reject a scope change. Approval needs the client sign-off when the change requires it.',
  },
});
