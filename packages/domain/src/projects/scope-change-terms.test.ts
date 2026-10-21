import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  budgetAfterFeeChange,
  clientSignOffIssues,
  scopeChangeApprovalBlocker,
  scopeChangeMoneyIssues,
} from './scope-change-terms';

const today = toCalendarDate('2026-10-21');

describe('scope change money and client sign-off', () => {
  it('accepts a positive cost and a fee in either direction', () => {
    expect(
      scopeChangeMoneyIssues({ costImpactMinor: 4_500_000, feeImpactMinor: -200_000 }),
    ).toEqual([]);
    expect(scopeChangeMoneyIssues({ costImpactMinor: null, feeImpactMinor: null })).toEqual([]);
  });

  it('refuses a zero or negative cost, a zero fee and fractions', () => {
    const fields = scopeChangeMoneyIssues({ costImpactMinor: -1, feeImpactMinor: 0 }).map(
      (issue) => issue.field,
    );
    expect(fields).toEqual(['costImpactMinor', 'feeImpactMinor']);
    expect(scopeChangeMoneyIssues({ costImpactMinor: 10.5, feeImpactMinor: null })).toHaveLength(1);
  });

  it('needs who confirmed, how, and a day that is not in the future', () => {
    const ok = {
      confirmedByName: 'Meera Rao',
      method: 'email' as const,
      confirmedOn: today,
      note: null,
    };
    expect(clientSignOffIssues(ok, today)).toEqual([]);
    const issues = clientSignOffIssues(
      { ...ok, confirmedByName: ' ', confirmedOn: toCalendarDate('2026-10-22') },
      today,
    );
    expect(issues.map((issue) => issue.field)).toEqual(['confirmedByName', 'confirmedOn']);
  });

  it('blocks approval until a required sign-off is recorded', () => {
    expect(
      scopeChangeApprovalBlocker({ requiresClientSignOff: true, clientSignedOff: false }),
    ).toMatch(/client has not signed off/);
    expect(
      scopeChangeApprovalBlocker({ requiresClientSignOff: true, clientSignedOff: true }),
    ).toBeNull();
    expect(
      scopeChangeApprovalBlocker({ requiresClientSignOff: false, clientSignedOff: false }),
    ).toBeNull();
  });

  it('adds the fee to the budget, never below zero, and leaves no budget alone', () => {
    expect(budgetAfterFeeChange(10_000_000, 2_500_000)).toBe(12_500_000);
    expect(budgetAfterFeeChange(1_000, -5_000)).toBe(0);
    expect(budgetAfterFeeChange(null, 2_500_000)).toBeNull();
    expect(budgetAfterFeeChange(10_000_000, null)).toBe(10_000_000);
  });
});
