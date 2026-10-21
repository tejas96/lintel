import type { CalendarDate } from '@lintel/shared';

/** A milestone completed in the period, with the people who owned its finished tasks. */
export interface MilestoneCompletionFact {
  readonly milestoneId: string;
  readonly name: string;
  readonly projectId: string;
  readonly dueDate: CalendarDate;
  readonly completedOn: CalendarDate;
  readonly contributorUserIds: readonly string[];
}

export interface PerformanceHighlight {
  readonly userId: string;
  readonly milestones: readonly MilestoneCompletionFact[];
}

/**
 * Performance highlights: milestones completed on or before their due date
 * in the period, credited to everyone who owned one of their finished tasks.
 * Most milestones first, then the most recent delivery.
 */
export function performanceHighlights(
  completions: readonly MilestoneCompletionFact[],
  limit: number,
): PerformanceHighlight[] {
  const byPerson = new Map<string, MilestoneCompletionFact[]>();
  for (const completion of completions) {
    if (completion.completedOn > completion.dueDate) continue;
    for (const userId of new Set(completion.contributorUserIds)) {
      byPerson.set(userId, [...(byPerson.get(userId) ?? []), completion]);
    }
  }
  const latest = (items: readonly MilestoneCompletionFact[]) =>
    items.reduce((max, item) => (item.completedOn > max ? item.completedOn : max), '');
  return [...byPerson.entries()]
    .map(([userId, milestones]) => ({
      userId,
      milestones: [...milestones].sort((left, right) =>
        right.completedOn.localeCompare(left.completedOn),
      ),
    }))
    .sort(
      (left, right) =>
        right.milestones.length - left.milestones.length ||
        latest(right.milestones).localeCompare(latest(left.milestones)) ||
        left.userId.localeCompare(right.userId),
    )
    .slice(0, limit);
}
