import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { calendarDateSchema, idSchema, noteSchema, versionSchema } from '../common/primitives';
import {
  projectCostCategorySchema,
  projectCostEntrySchema,
  projectProfitabilitySchema,
} from '../schemas/finance.schema';

const c = initContract();

const projectParams = z.object({ projectId: idSchema });

const finances =
  ' Needs profitability switched on and finance access to the project (`projects.manage_any`, or its manager or owner); otherwise 404.';

export const projectCostsContract = c.router({
  getProjectProfitability: {
    method: 'GET',
    path: '/projects/:projectId/profitability',
    pathParams: projectParams,
    responses: { 200: projectProfitabilitySchema },
    summary: `Budget against recorded cost, remaining budget and margin, with the cost ledger.${finances}`,
  },
  recordProjectCost: {
    method: 'POST',
    path: '/projects/:projectId/costs',
    pathParams: projectParams,
    body: z.object({
      entryDate: calendarDateSchema,
      category: projectCostCategorySchema,
      amountMinor: z.number().int().min(1).max(1_000_000_000_000),
      note: z.string().trim().max(500).nullable(),
    }),
    responses: { 201: projectCostEntrySchema },
    summary: `Records a cost on the project ledger (audited).${finances}`,
  },
  voidProjectCost: {
    method: 'POST',
    path: '/projects/:projectId/costs/:costId/void',
    pathParams: projectParams.extend({ costId: idSchema }),
    body: z.object({ reason: noteSchema, version: versionSchema }),
    responses: { 200: projectCostEntrySchema },
    summary: `Voids a cost entry; it stays on the ledger with the reason (audited).${finances}`,
  },
});
