import { describe, expect, it } from 'vitest';
import {
  assessProfitability,
  compareByMarginAttention,
  THIN_MARGIN_THRESHOLD,
} from './project-profitability';

describe('project profitability', () => {
  it('has no indicator without a budget', () => {
    expect(assessProfitability(null, 50_000_00)).toEqual({
      budgetMinor: null,
      recordedCostMinor: 50_000_00,
      remainingMinor: null,
      marginRatio: null,
      indicator: 'no_budget',
    });
    expect(assessProfitability(0, 0).indicator).toBe('no_budget');
  });

  it('computes the remaining budget and margin in minor units', () => {
    const result = assessProfitability(10_00_000_00, 6_00_000_00);
    expect(result.remainingMinor).toBe(4_00_000_00);
    expect(result.marginRatio).toBe(0.4);
    expect(result.indicator).toBe('healthy');
  });

  it('marks a margin under the threshold as thin, including exactly zero left', () => {
    expect(assessProfitability(100_000, 90_000).indicator).toBe('thin');
    expect(assessProfitability(100_000, 100_000)).toMatchObject({
      remainingMinor: 0,
      marginRatio: 0,
      indicator: 'thin',
    });
    const atThreshold = assessProfitability(100_000, 100_000 * (1 - THIN_MARGIN_THRESHOLD));
    expect(atThreshold.indicator).toBe('healthy');
  });

  it('flags spending beyond the budget with a negative remainder', () => {
    const result = assessProfitability(100_000, 112_500);
    expect(result.remainingMinor).toBe(-12_500);
    expect(result.marginRatio).toBe(-0.125);
    expect(result.indicator).toBe('over_budget');
  });

  it('starts with no cost recorded as fully healthy', () => {
    expect(assessProfitability(500_000, 0)).toMatchObject({ marginRatio: 1, indicator: 'healthy' });
  });

  it('orders projects by how much attention their margin needs', () => {
    const rows = [
      assessProfitability(100, 10),
      assessProfitability(null, 0),
      assessProfitability(100, 120),
      assessProfitability(100, 95),
      assessProfitability(100, 50),
    ].sort(compareByMarginAttention);
    expect(rows.map((row) => row.indicator)).toEqual([
      'over_budget',
      'thin',
      'healthy',
      'healthy',
      'no_budget',
    ]);
    expect(rows[2]?.marginRatio).toBe(0.5);
  });
});
