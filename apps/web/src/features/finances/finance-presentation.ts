import type { PillTone, StatusGlyphName } from '@lintel/design-system/web';
import type { MarginIndicator } from '@lintel/domain';

/** The margin is a status: colour, glyph and word together. */
export const MARGIN_PRESENTATION: Readonly<
  Record<
    MarginIndicator,
    {
      readonly tone: PillTone;
      readonly glyph: StatusGlyphName;
      readonly label: string;
      /** Fill for the spent part of a budget bar (static for Tailwind). */
      readonly bar: string;
    }
  >
> = {
  healthy: { tone: 'onTrack', glyph: 'onTrack', label: 'Healthy margin', bar: 'bg-on-track-solid' },
  thin: { tone: 'atRisk', glyph: 'atRisk', label: 'Thin margin', bar: 'bg-at-risk-solid' },
  over_budget: { tone: 'overdue', glyph: 'overdue', label: 'Over budget', bar: 'bg-overdue-solid' },
  no_budget: { tone: 'neutral', glyph: 'notStarted', label: 'No budget set', bar: 'bg-ink-faint' },
};

/** "₹4,20,000" — whole amounts drop the paise; Indian digit grouping. */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/** "38% left", "12% over". */
export function describeMargin(marginRatio: number | null): string | null {
  if (marginRatio === null) return null;
  const percent = Math.round(Math.abs(marginRatio) * 100);
  return marginRatio < 0 ? `${percent}% over` : `${percent}% left`;
}

/** Rupees typed by a person ("1,25,000.50" or "₹ 4500") → paise, or null when not an amount. */
export function rupeesToMinor(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 100);
  return minor > 0 && Number.isSafeInteger(minor) ? minor : null;
}
