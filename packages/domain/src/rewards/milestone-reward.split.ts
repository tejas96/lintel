/**
 * Splits a shared reward into equal shares in minor units. The remainder
 * (amount mod people) goes one minor unit each to the first recipients, in
 * the order given (by name), so the shares always add up to the amount.
 */
export function splitMilestoneReward(amountMinor: number, recipients: number): number[] {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError('A reward amount is a whole, non-negative number of minor units.');
  }
  if (!Number.isInteger(recipients) || recipients < 1) {
    throw new RangeError('A reward needs at least one recipient.');
  }
  const base = Math.floor(amountMinor / recipients);
  const remainder = amountMinor - base * recipients;
  return Array.from({ length: recipients }, (_, index) => base + (index < remainder ? 1 : 0));
}
