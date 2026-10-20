/**
 * Money is always an integer number of minor units (paise for INR) plus an
 * ISO-4217 currency code. Floating-point rupee values are never stored.
 */
export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('Money amounts must be whole minor units.');
  }
  return { amountMinor, currency };
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new RangeError(`Cannot add ${left.currency} to ${right.currency}.`);
  }
  return money(left.amountMinor + right.amountMinor, left.currency);
}

export function formatMoney(value: Money, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    maximumFractionDigits: 2,
  }).format(value.amountMinor / 100);
}
