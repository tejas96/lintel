/**
 * English counts for user-facing sentences: never "1 tasks" or "task(s)".
 * Irregular plurals ("person" → "people") are passed explicitly.
 */
export function pluralWord(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** "1 task", "3 tasks", "0 tasks". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${pluralWord(count, singular, plural)}`;
}

/** "is" for one, "are" for any other count. */
export function isOrAre(count: number): 'is' | 'are' {
  return count === 1 ? 'is' : 'are';
}

/** "was" for one, "were" for any other count. */
export function wasOrWere(count: number): 'was' | 'were' {
  return count === 1 ? 'was' : 'were';
}
