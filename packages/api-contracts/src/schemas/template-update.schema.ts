import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';

export const templateFieldSchema = z.enum([
  'name',
  'description',
  'title',
  'priority',
  'requiresReview',
  'estimateMinutes',
  'escalateAfterOverdueDays',
  'requiresClientApproval',
  'stage',
  'milestone',
  'duration',
  'checklist',
  'prerequisites',
  'deliverables',
]);

const fieldChangeObject = z.object({
  field: templateFieldSchema,
  from: z.string().nullable(),
  to: z.string().nullable(),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  /**
   * apply: changes. held: changes only when ticked. kept: this project changed it itself.
   * unavailable: a move to a stage or milestone the update cannot add here; never applies.
   */
  outcome: z.enum(['apply', 'held', 'kept', 'unavailable']),
});

export const templateUpdateItemObject = z.object({
  key: z.string(),
  kind: z.enum(['stage', 'milestone', 'task']),
  change: z.enum(['added', 'changed', 'removed']),
  templateKey: z.string(),
  itemId: idSchema.nullable(),
  name: z.string(),
  stageKey: z.string().nullable(),
  stageName: z.string().nullable(),
  status: z.string().nullable(),
  fields: z.array(fieldChangeObject),
  dates: z
    .object({
      fromStart: calendarDateSchema.nullable(),
      fromDue: calendarDateSchema.nullable(),
      toStart: calendarDateSchema.nullable(),
      toDue: calendarDateSchema.nullable(),
    })
    .nullable(),
  optIn: z.object({ reason: z.string() }).nullable(),
  blocked: z.object({ reason: z.string() }).nullable(),
  schedule: z
    .object({
      plannedStartDate: calendarDateSchema,
      dueDate: calendarDateSchema,
      owner: userSummarySchema.nullable(),
    })
    .nullable(),
  willApply: z.boolean(),
  ticked: z.boolean(),
});
export type TemplateUpdateItem = z.infer<typeof templateUpdateItemObject>;

export const templateUpdatePreviewObject = z.object({
  projectId: idSchema,
  projectVersion: z.number().int(),
  template: z.object({ id: idSchema, name: z.string() }),
  from: z.object({ id: idSchema, versionNumber: z.number().int() }),
  to: z.object({
    id: idSchema,
    versionNumber: z.number().int(),
    changeNotes: z.string().nullable(),
  }),
  items: z.array(templateUpdateItemObject),
  unchanged: z.object({
    stages: z.number().int(),
    milestones: z.number().int(),
    tasks: z.number().int(),
  }),
  plannedEndDate: calendarDateSchema,
  forecastEndDate: calendarDateSchema.nullable(),
});
export type TemplateUpdatePreview = z.infer<typeof templateUpdatePreviewObject>;
export const templateUpdatePreviewSchema: ResponseSchema<TemplateUpdatePreview> =
  templateUpdatePreviewObject;

export const templateUpdateHistoryObject = z.object({
  id: idSchema,
  fromVersionNumber: z.number().int(),
  toVersionNumber: z.number().int(),
  appliedBy: userSummarySchema.nullable(),
  appliedAt: instantSchema,
  added: z.number().int(),
  changed: z.number().int(),
  cancelled: z.number().int(),
  heldBack: z.number().int(),
  extendedPlannedEndTo: calendarDateSchema.nullable(),
});

export const templateUpdateStatusObject = z.object({
  template: z.object({ id: idSchema, name: z.string() }).nullable(),
  current: z.object({ id: idSchema, versionNumber: z.number().int() }).nullable(),
  available: z
    .object({
      id: idSchema,
      versionNumber: z.number().int(),
      changeNotes: z.string().nullable(),
    })
    .nullable(),
  viewerCanUpdate: z.boolean(),
  history: z.array(templateUpdateHistoryObject),
});
export type TemplateUpdateStatus = z.infer<typeof templateUpdateStatusObject>;
export const templateUpdateStatusSchema: ResponseSchema<TemplateUpdateStatus> =
  templateUpdateStatusObject;

export const templateUpdateResultObject = z.object({
  toVersionNumber: z.number().int(),
  added: z.number().int(),
  changed: z.number().int(),
  cancelled: z.number().int(),
  heldBack: z.number().int(),
  extendedPlannedEndTo: calendarDateSchema.nullable(),
});
export type TemplateUpdateResult = z.infer<typeof templateUpdateResultObject>;
export const templateUpdateResultSchema: ResponseSchema<TemplateUpdateResult> =
  templateUpdateResultObject;
