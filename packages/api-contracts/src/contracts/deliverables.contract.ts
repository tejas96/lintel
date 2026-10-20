import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, noteSchema, shortTextSchema, versionSchema } from '../common/primitives';
import {
  approvalItemSchema,
  deliverableDetailSchema,
  deliverableSummarySchema,
  siteUpdateSchema,
} from '../schemas/deliverable.schema';
import { fileSummarySchema } from '../schemas/task.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

export const deliverablesContract = c.router({
  uploadFile: {
    method: 'POST',
    path: '/files',
    contentType: 'multipart/form-data',
    body: c.type<{ file: Blob; projectId?: string; visibility?: 'project' | 'confidential' }>(),
    responses: { 201: fileSummarySchema },
    summary:
      'Upload one file (field "file"). Type is detected from content; size is limited. Download with GET /v1/files/:id/content.',
  },
  attachFileToTask: {
    method: 'POST',
    path: '/tasks/:id/attachments',
    pathParams: idParams,
    body: z.object({ fileId: idSchema }),
    responses: { 200: z.object({ fileId: idSchema }) },
  },
  listProjectDeliverables: {
    method: 'GET',
    path: '/projects/:id/deliverables',
    pathParams: idParams,
    responses: { 200: z.array(deliverableSummarySchema) },
  },
  createDeliverable: {
    method: 'POST',
    path: '/deliverables',
    body: z.object({
      projectId: idSchema,
      taskId: idSchema.nullable(),
      name: shortTextSchema,
      description: z.string().max(2000).nullable(),
      isRequired: z.boolean(),
      reviewerUserId: idSchema.nullable(),
    }),
    responses: { 201: deliverableDetailSchema },
  },
  getDeliverable: {
    method: 'GET',
    path: '/deliverables/:id',
    pathParams: idParams,
    responses: { 200: deliverableDetailSchema },
  },
  submitDeliverableVersion: {
    method: 'POST',
    path: '/deliverables/:id/versions',
    pathParams: idParams,
    body: z.object({
      fileId: idSchema,
      note: z.string().max(2000).nullable(),
      version: versionSchema,
    }),
    responses: { 201: deliverableDetailSchema },
    summary: 'Submit a new version for review. Earlier versions are kept.',
  },
  reviewDeliverableVersion: {
    method: 'POST',
    path: '/deliverable-versions/:id/review',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(['approved', 'changes_requested', 'rejected']),
      comment: z.string().trim().max(2000).nullable(),
      version: versionSchema,
    }),
    responses: { 200: deliverableDetailSchema },
    summary: 'Approve, request changes or reject. Self-review is never allowed.',
  },
  myApprovalQueue: {
    method: 'GET',
    path: '/me/approvals',
    responses: { 200: z.array(approvalItemSchema) },
    summary: 'Everything waiting for the signed-in person’s decision.',
  },
  listSiteUpdates: {
    method: 'GET',
    path: '/projects/:id/site-updates',
    pathParams: idParams,
    responses: { 200: z.array(siteUpdateSchema) },
  },
  createSiteUpdate: {
    method: 'POST',
    path: '/projects/:id/site-updates',
    pathParams: idParams,
    body: z.object({
      taskId: idSchema.nullable(),
      note: noteSchema,
      hasIssue: z.boolean(),
      photoFileIds: z.array(idSchema).max(12),
    }),
    responses: { 201: siteUpdateSchema },
  },
});
