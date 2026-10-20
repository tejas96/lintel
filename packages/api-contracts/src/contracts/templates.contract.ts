import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  emptyBodySchema,
  idSchema,
  queryBooleanSchema,
  shortTextSchema,
  versionSchema,
} from '../common/primitives';
import { projectTypeSchema } from '../schemas/project.schema';
import {
  templateDetailSchema,
  templateSummarySchema,
  workflowDefinitionSchema,
} from '../schemas/template.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

export const templatesContract = c.router({
  listTemplates: {
    method: 'GET',
    path: '/templates',
    query: z.object({
      projectType: projectTypeSchema.optional(),
      includeArchived: queryBooleanSchema.default(false),
    }),
    responses: { 200: z.array(templateSummarySchema) },
  },
  getTemplate: {
    method: 'GET',
    path: '/templates/:id',
    pathParams: idParams,
    responses: { 200: templateDetailSchema },
  },
  createTemplate: {
    method: 'POST',
    path: '/templates',
    body: z.object({
      name: shortTextSchema,
      description: z.string().max(1000).nullable(),
      projectType: projectTypeSchema,
      /** Start from the built-in preset for the project type, or from an existing version. */
      copyFromVersionId: idSchema.nullable(),
    }),
    responses: { 201: templateDetailSchema },
  },
  saveDraft: {
    method: 'PUT',
    path: '/templates/:id/draft',
    pathParams: idParams,
    body: z.object({
      definition: workflowDefinitionSchema,
      changeNotes: z.string().max(1000).nullable(),
      version: versionSchema.nullable(),
    }),
    responses: { 200: templateDetailSchema },
    summary: 'Create or update the draft version. Published versions never change.',
  },
  publishDraft: {
    method: 'POST',
    path: '/templates/:id/publish',
    pathParams: idParams,
    body: z.object({ version: versionSchema }),
    responses: { 200: templateDetailSchema },
    summary:
      'Validate and publish the draft. Existing projects keep the version they started with.',
  },
  archiveTemplate: {
    method: 'POST',
    path: '/templates/:id/archive',
    pathParams: idParams,
    body: emptyBodySchema,
    responses: { 200: templateDetailSchema },
  },
});
