import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, versionSchema } from '../common/primitives';
import {
  templateUpdatePreviewSchema,
  templateUpdateResultSchema,
  templateUpdateStatusSchema,
} from '../schemas/template-update.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

/** Keys of held items (started work, committed dates) the manager explicitly ticked. */
const tickedSchema = z.array(z.string().max(300)).max(500);

/** Moving a running project to a newer published version of its template. */
export const templateUpdatesContract = c.router({
  getTemplateUpdateStatus: {
    method: 'GET',
    path: '/projects/:id/template-update',
    pathParams: idParams,
    responses: { 200: templateUpdateStatusSchema },
    summary:
      'The template version the project follows, whether a newer one is published, and past updates.',
  },
  previewTemplateUpdate: {
    method: 'POST',
    path: '/projects/:id/template-update/preview',
    pathParams: idParams,
    body: z.object({ targetVersionId: idSchema, ticked: tickedSchema }),
    responses: { 200: templateUpdatePreviewSchema },
    summary:
      'Dry run: what would be added, changed and removed, what is held back and why, and the forecast end. Nothing is saved.',
  },
  applyTemplateUpdate: {
    method: 'POST',
    path: '/projects/:id/template-update',
    pathParams: idParams,
    body: z.object({
      targetVersionId: idSchema,
      ticked: tickedSchema,
      extendPlannedEnd: z.boolean(),
      version: versionSchema,
    }),
    responses: { 200: templateUpdateResultSchema },
    summary:
      'Apply: adds new items, updates unstarted ones, cancels removed unstarted tasks. Started work and committed dates change only when ticked. Project managers only.',
  },
});
