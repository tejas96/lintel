import { MARGIN_INDICATORS, PROJECT_COST_CATEGORIES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  moneyMinorSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';

export const projectCostCategorySchema = z.enum(PROJECT_COST_CATEGORIES);
export const marginIndicatorSchema = z.enum(MARGIN_INDICATORS);

const assessment = {
  budgetMinor: moneyMinorSchema.nullable(),
  recordedCostMinor: moneyMinorSchema,
  remainingMinor: moneyMinorSchema.nullable(),
  /** (Budget − recorded cost) ÷ budget; null without a budget. */
  marginRatio: z.number().nullable(),
  indicator: marginIndicatorSchema,
};

export const projectCostEntryObject = z.object({
  id: idSchema,
  entryDate: calendarDateSchema,
  category: projectCostCategorySchema,
  amountMinor: moneyMinorSchema,
  currency: z.string(),
  note: z.string().nullable(),
  recordedBy: userSummarySchema,
  createdAt: instantSchema,
  voidedAt: instantSchema.nullable(),
  voidedBy: userSummarySchema.nullable(),
  voidReason: z.string().nullable(),
  /** The approved scope change whose cost this entry records, if any. */
  scopeChangeId: idSchema.nullable(),
  version: z.number().int(),
});
export type ProjectCostEntry = z.infer<typeof projectCostEntryObject>;
export const projectCostEntrySchema: ResponseSchema<ProjectCostEntry> = projectCostEntryObject;

export const projectProfitabilityObject = z.object({
  projectId: idSchema,
  currency: z.string(),
  ...assessment,
  /** Recorded (not voided) cost per category, every category listed. */
  byCategory: z.array(
    z.object({ category: projectCostCategorySchema, amountMinor: moneyMinorSchema }),
  ),
  /** Newest first, voided entries included (they never count). */
  entries: z.array(projectCostEntrySchema),
  entryCount: z.number().int(),
});
export type ProjectProfitability = z.infer<typeof projectProfitabilityObject>;
export const projectProfitabilitySchema: ResponseSchema<ProjectProfitability> =
  projectProfitabilityObject;

/** Budget against cost across the projects in a command center view. */
export const portfolioProfitabilityObject = z.object({
  currency: z.string(),
  ...assessment,
  projectsWithBudget: z.number().int(),
  projectsOverBudget: z.number().int(),
  projectsThinMargin: z.number().int(),
  /** Most attention first: over budget, thin, healthy, then without a budget. */
  projects: z.array(z.object({ project: projectRefSchema, ...assessment })),
});
export type PortfolioProfitability = z.infer<typeof portfolioProfitabilityObject>;
export const portfolioProfitabilitySchema: ResponseSchema<PortfolioProfitability> =
  portfolioProfitabilityObject;
