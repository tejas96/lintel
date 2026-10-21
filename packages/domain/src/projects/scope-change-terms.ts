import type { CalendarDate } from '@lintel/shared';

/** How the client confirmed a scope change. */
export const CLIENT_SIGN_OFF_METHODS = ['meeting', 'email', 'call', 'message'] as const;
export type ClientSignOffMethod = (typeof CLIENT_SIGN_OFF_METHODS)[number];

export const CLIENT_SIGN_OFF_METHOD_LABELS: Readonly<Record<ClientSignOffMethod, string>> = {
  meeting: 'In a meeting',
  email: 'By email',
  call: 'On a call',
  message: 'By message',
};

/** Ten thousand crore in paise: far beyond any studio change, small enough to stay exact. */
export const MAX_SCOPE_CHANGE_AMOUNT_MINOR = 1_000_000_000_000;

/**
 * What a scope change does to the money, in integer minor units. The cost is
 * what the extra work costs the studio (recorded on the cost ledger when the
 * change is approved); the fee is what the client pays more (or less), added
 * to the project budget on approval.
 */
export interface ScopeChangeMoney {
  readonly costImpactMinor: number | null;
  readonly feeImpactMinor: number | null;
}

export interface TermsIssue {
  readonly field: string;
  readonly message: string;
}

export function scopeChangeMoneyIssues(money: ScopeChangeMoney): TermsIssue[] {
  const issues: TermsIssue[] = [];
  const cost = money.costImpactMinor;
  if (
    cost !== null &&
    (!Number.isSafeInteger(cost) || cost <= 0 || cost > MAX_SCOPE_CHANGE_AMOUNT_MINOR)
  ) {
    issues.push({
      field: 'costImpactMinor',
      message: 'Enter a cost above zero, or leave it empty.',
    });
  }
  const fee = money.feeImpactMinor;
  if (
    fee !== null &&
    (!Number.isSafeInteger(fee) || fee === 0 || Math.abs(fee) > MAX_SCOPE_CHANGE_AMOUNT_MINOR)
  ) {
    issues.push({
      field: 'feeImpactMinor',
      message: 'Enter the extra fee (or a negative amount for a reduction), or leave it empty.',
    });
  }
  return issues;
}

export interface ClientSignOff {
  /** The person at the client who confirmed, e.g. "Meera Rao". */
  readonly confirmedByName: string;
  readonly method: ClientSignOffMethod;
  /** The day they confirmed, in the business timezone. */
  readonly confirmedOn: CalendarDate;
  readonly note: string | null;
}

export function clientSignOffIssues(signOff: ClientSignOff, today: CalendarDate): TermsIssue[] {
  const issues: TermsIssue[] = [];
  const name = signOff.confirmedByName.trim();
  if (name.length < 2 || name.length > 120) {
    issues.push({ field: 'confirmedByName', message: 'Who at the client confirmed it?' });
  }
  if (!CLIENT_SIGN_OFF_METHODS.includes(signOff.method)) {
    issues.push({ field: 'method', message: 'Choose how they confirmed it.' });
  }
  if (signOff.confirmedOn > today) {
    issues.push({ field: 'confirmedOn', message: 'Record a sign-off on or before today.' });
  }
  return issues;
}

/** Why a scope change cannot be approved yet, or null when nothing stands in the way. */
export function scopeChangeApprovalBlocker(change: {
  readonly requiresClientSignOff: boolean;
  readonly clientSignedOff: boolean;
}): string | null {
  if (change.requiresClientSignOff && !change.clientSignedOff) {
    return 'The client has not signed off yet. Record who confirmed it, when and how before approving.';
  }
  return null;
}

/**
 * The project budget once an approved fee change applies. A project without
 * a budget keeps none (there is nothing to adjust); a budget never goes below
 * zero.
 */
export function budgetAfterFeeChange(
  budgetMinor: number | null,
  feeImpactMinor: number | null,
): number | null {
  if (budgetMinor === null || feeImpactMinor === null) return budgetMinor;
  return Math.max(0, budgetMinor + feeImpactMinor);
}
