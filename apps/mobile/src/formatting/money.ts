const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, fractionDigits: 0 | 2): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  formatters.set(key, formatter);
  return formatter;
}

/**
 * An amount in minor units, Indian-grouped: "₹3,000", "₹43,68,000",
 * "₹2,500.01". Whole rupees drop the paise, as on the web.
 */
export function formatAmount(amountMinor: number, currency: string): string {
  return formatterFor(currency, amountMinor % 100 === 0 ? 0 : 2).format(amountMinor / 100);
}
