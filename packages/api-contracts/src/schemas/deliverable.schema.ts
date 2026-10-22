import { DELIVERABLE_STATUSES } from '@lintel/domain';
import { z } from 'zod';
import { idSchema, instantSchema, type ResponseSchema } from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';
import { fileSummarySchema, taskRefSchema } from './task.schema';

export const deliverableStatusSchema = z.enum(DELIVERABLE_STATUSES);

export const deliverableVersionObject = z.object({
  id: idSchema,
  versionNumber: z.number().int(),
  file: fileSummarySchema,
  note: z.string().nullable(),
  submittedBy: userSummarySchema,
  submittedAt: instantSchema,
  decision: z.enum(['pending', 'approved', 'changes_requested', 'rejected']),
  reviewedBy: userSummarySchema.nullable(),
  reviewedAt: instantSchema.nullable(),
  reviewComment: z.string().nullable(),
});
export type DeliverableVersion = z.infer<typeof deliverableVersionObject>;
export const deliverableVersionSchema: ResponseSchema<DeliverableVersion> =
  deliverableVersionObject;

export const deliverableSummaryObject = z.object({
  id: idSchema,
  project: projectRefSchema,
  task: taskRefSchema.nullable(),
  name: z.string(),
  isRequired: z.boolean(),
  status: deliverableStatusSchema,
  reviewer: userSummarySchema.nullable(),
  currentVersionNumber: z.number().int(),
  latestVersion: deliverableVersionSchema.nullable(),
  version: z.number().int(),
});
export type DeliverableSummary = z.infer<typeof deliverableSummaryObject>;
export const deliverableSummarySchema: ResponseSchema<DeliverableSummary> =
  deliverableSummaryObject;

export const deliverableDetailObject = deliverableSummaryObject.extend({
  description: z.string().nullable(),
  versions: z.array(deliverableVersionSchema),
  viewerCanReview: z.boolean(),
  viewerCanSubmit: z.boolean(),
});
export type DeliverableDetail = z.infer<typeof deliverableDetailObject>;
export const deliverableDetailSchema: ResponseSchema<DeliverableDetail> = deliverableDetailObject;

export const approvalItemObject = z.object({
  type: z.enum([
    'deliverable_review',
    'task_review',
    'leave_request',
    'scope_change',
    'reward_review',
    'priority_conflict',
    'reassignment_request',
    'date_change_request',
    'leave_handover',
  ]),
  id: idSchema,
  title: z.string(),
  subtitle: z.string(),
  requestedBy: userSummarySchema.nullable(),
  requestedAt: instantSchema,
  project: projectRefSchema.nullable(),
  linkPath: z.string(),
  urgency: z.enum(['normal', 'high']),
});
export type ApprovalItem = z.infer<typeof approvalItemObject>;
export const approvalItemSchema: ResponseSchema<ApprovalItem> = approvalItemObject;

export const siteUpdateObject = z.object({
  id: idSchema,
  project: projectRefSchema,
  task: taskRefSchema.nullable(),
  author: userSummarySchema,
  note: z.string(),
  hasIssue: z.boolean(),
  photos: z.array(fileSummarySchema),
  createdAt: instantSchema,
});
export type SiteUpdate = z.infer<typeof siteUpdateObject>;
export const siteUpdateSchema: ResponseSchema<SiteUpdate> = siteUpdateObject;
