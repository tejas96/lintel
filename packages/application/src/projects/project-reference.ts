/** Minimum digits in the sequence part: "ARN-2026-007". Longer numbers keep all their digits. */
const SEQUENCE_DIGITS = 3;

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatProjectReference(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

/** The LIKE pattern that finds every reference of a series, e.g. "ARN-2026-%". */
export function projectReferenceSeriesPattern(prefix: string, year: number): string {
  return `${prefix}-${year}-%`;
}

/**
 * The next reference in a yearly series: `<prefix>-<YYYY>-<NNN>`, one more
 * than the highest number already issued. Gaps (deleted projects) are never
 * reused, and references that do not follow the pattern are ignored.
 */
export function nextProjectReference(
  prefix: string,
  year: number,
  existing: readonly string[],
): string {
  const pattern = new RegExp(`^${escapeForPattern(prefix)}-${year}-(\\d+)$`);
  let highest = 0;
  for (const reference of existing) {
    const match = pattern.exec(reference);
    const sequence = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
    if (Number.isSafeInteger(sequence) && sequence > highest) highest = sequence;
  }
  return formatProjectReference(prefix, year, highest + 1);
}
