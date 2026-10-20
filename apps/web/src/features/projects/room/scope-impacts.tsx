import type { ScopeChange } from '@lintel/api-contracts';
import { cn } from '@lintel/design-system/web';
import { ArrowRight } from 'lucide-react';
import { formatCalendarDate } from '@/lib/format/dates';

function shiftWords(days: number): string {
  if (days === 0) return 'no change';
  const size = Math.abs(days);
  return `${size} working ${size === 1 ? 'day' : 'days'} ${days > 0 ? 'later' : 'earlier'}`;
}

/** Which tasks move and by how much, including the ones that move only because they depend on others. */
export function ScopeImpacts({
  impacts,
  projectEndImpactDays,
  today,
}: {
  readonly impacts: ScopeChange['impacts'];
  readonly projectEndImpactDays: number;
  readonly today: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          'type-body-sm font-medium',
          projectEndImpactDays > 0 ? 'text-at-risk' : 'text-ink',
        )}
      >
        {projectEndImpactDays === 0
          ? 'The project end date does not move.'
          : `The project ends ${shiftWords(projectEndImpactDays)}.`}
      </p>
      <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-raised">
        {impacts.map((impact) => (
          <li
            key={impact.taskId}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5"
          >
            <span className="min-w-0 flex-1 truncate type-body-sm text-ink">
              {impact.taskTitle}
              {impact.isDownstream && (
                <span className="text-ink-faint"> (follows from another task)</span>
              )}
            </span>
            <span className="flex items-center gap-1.5 type-body-sm text-ink-muted tabular-nums">
              {impact.currentDueDate ? formatCalendarDate(impact.currentDueDate, today) : 'No date'}
              <ArrowRight aria-hidden className="size-3.5" />
              <span className="sr-only">to</span>
              <span className="text-ink">
                {impact.proposedDueDate
                  ? formatCalendarDate(impact.proposedDueDate, today)
                  : 'No date'}
              </span>
            </span>
            <span className="w-full type-body-sm text-ink-faint sm:w-40 sm:text-right">
              {shiftWords(impact.shiftWorkingDays)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
