/** What a project cost entry was spent on. */
export const PROJECT_COST_CATEGORIES = ['consultant', 'material', 'site', 'other'] as const;
export type ProjectCostCategory = (typeof PROJECT_COST_CATEGORIES)[number];

export const PROJECT_COST_CATEGORY_LABELS: Readonly<Record<ProjectCostCategory, string>> = {
  consultant: 'Consultants',
  material: 'Materials',
  site: 'Site work',
  other: 'Other',
};

/** Below this share of the budget left, the margin is "thin". */
export const THIN_MARGIN_THRESHOLD = 0.15;

/**
 * no_budget: nothing to compare against. over_budget: recorded cost exceeds
 * the budget. thin: less than 15 % of the budget left. healthy: otherwise.
 */
export const MARGIN_INDICATORS = ['healthy', 'thin', 'over_budget', 'no_budget'] as const;
export type MarginIndicator = (typeof MARGIN_INDICATORS)[number];

export interface ProfitabilityAssessment {
  readonly budgetMinor: number | null;
  readonly recordedCostMinor: number;
  /** Budget − recorded cost (negative when over budget); null without a budget. */
  readonly remainingMinor: number | null;
  /** (Budget − recorded cost) ÷ budget, rounded to 0.001; null without a budget. */
  readonly marginRatio: number | null;
  readonly indicator: MarginIndicator;
}

const roundRatio = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Budget against recorded cost. Every amount is integer minor units of one
 * currency; voided entries must already be left out of `recordedCostMinor`.
 */
export function assessProfitability(
  budgetMinor: number | null,
  recordedCostMinor: number,
): ProfitabilityAssessment {
  if (budgetMinor === null || budgetMinor <= 0) {
    return {
      budgetMinor,
      recordedCostMinor,
      remainingMinor: null,
      marginRatio: null,
      indicator: 'no_budget',
    };
  }
  const remainingMinor = budgetMinor - recordedCostMinor;
  const marginRatio = roundRatio(remainingMinor / budgetMinor);
  const indicator: MarginIndicator =
    remainingMinor < 0 ? 'over_budget' : marginRatio < THIN_MARGIN_THRESHOLD ? 'thin' : 'healthy';
  return { budgetMinor, recordedCostMinor, remainingMinor, marginRatio, indicator };
}

const ATTENTION: Readonly<Record<MarginIndicator, number>> = {
  over_budget: 0,
  thin: 1,
  healthy: 2,
  no_budget: 3,
};

/** Over budget first, then thin margins, then healthy, then projects without a budget. */
export function compareByMarginAttention(
  left: Pick<ProfitabilityAssessment, 'indicator' | 'marginRatio'>,
  right: Pick<ProfitabilityAssessment, 'indicator' | 'marginRatio'>,
): number {
  return (
    ATTENTION[left.indicator] - ATTENTION[right.indicator] ||
    (left.marginRatio ?? 1) - (right.marginRatio ?? 1)
  );
}
