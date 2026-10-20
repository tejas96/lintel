import { PROJECT_ROLES, TASK_PRIORITIES } from '@lintel/domain';
import { z } from 'zod';
import { idSchema, instantSchema, type ResponseSchema } from '../common/primitives';
import { projectTypeSchema } from './project.schema';

const key = z.string().regex(/^[a-z0-9-]{2,60}$/, 'Use lowercase letters, numbers and dashes.');
const role = z.enum(PROJECT_ROLES);

export const templateTaskSchema = z.object({
  key,
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  milestoneKey: key.optional(),
  responsibleRole: role,
  durationDays: z.number().int().min(1).max(365),
  estimateMinutes: z.number().int().min(0).max(100_000).optional(),
  dependsOn: z.array(key),
  priority: z.enum(TASK_PRIORITIES),
  requiresReview: z.boolean(),
  reviewerRole: role.optional(),
  checklist: z.array(z.object({ label: z.string().min(1).max(200), required: z.boolean() })),
  deliverables: z.array(z.object({ name: z.string().min(1).max(200), required: z.boolean() })),
  escalateAfterOverdueDays: z.number().int().min(0).max(30).optional(),
  subtasks: z
    .array(
      z.object({ title: z.string().min(1).max(200), estimateMinutes: z.number().int().optional() }),
    )
    .optional(),
});

export const templateStageSchema = z.object({
  key,
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  requiresOptions: z.array(z.string()).optional(),
  milestones: z.array(
    z.object({ key, name: z.string().min(2).max(120), requiresClientApproval: z.boolean() }),
  ),
  tasks: z.array(templateTaskSchema),
});

export const workflowDefinitionSchema = z.object({
  options: z.array(z.object({ key: z.string(), label: z.string(), enabledByDefault: z.boolean() })),
  stages: z.array(templateStageSchema).min(1).max(20),
});

export const templateVersionObject = z.object({
  id: idSchema,
  versionNumber: z.number().int(),
  status: z.enum(['draft', 'published', 'retired']),
  definition: workflowDefinitionSchema,
  changeNotes: z.string().nullable(),
  publishedAt: instantSchema.nullable(),
  projectCount: z.number().int(),
  version: z.number().int(),
});
export type TemplateVersion = z.infer<typeof templateVersionObject>;
export const templateVersionSchema: ResponseSchema<TemplateVersion> = templateVersionObject;

export const templateSummaryObject = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  projectType: projectTypeSchema,
  publishedVersion: z
    .object({
      id: idSchema,
      versionNumber: z.number().int(),
      stageCount: z.number().int(),
      taskCount: z.number().int(),
    })
    .nullable(),
  hasDraft: z.boolean(),
  archivedAt: instantSchema.nullable(),
});
export type TemplateSummary = z.infer<typeof templateSummaryObject>;
export const templateSummarySchema: ResponseSchema<TemplateSummary> = templateSummaryObject;

export const templateDetailObject = templateSummaryObject.extend({
  versions: z.array(templateVersionSchema),
});
export type TemplateDetail = z.infer<typeof templateDetailObject>;
export const templateDetailSchema: ResponseSchema<TemplateDetail> = templateDetailObject;
