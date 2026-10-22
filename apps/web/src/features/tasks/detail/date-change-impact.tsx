'use client';

import type { DateChangeImpact } from '@lintel/api-contracts';
import { SkeletonText } from '@lintel/design-system/web';
import { ArrowRight, CalendarClock, Milestone } from 'lucide-react';
import { formatCalendarDate } from '@/lib/format/dates';

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Latest open work ends 4 Nov → 6 Nov (2 working days later)", or that it stays put. */
function deliveryLine(impact: DateChangeImpact, today: string): string {
  const current = impact.currentForecastEndDate;
  const next = impact.forecastEndDate;
  if (!next || impact.forecastShiftWorkingDays === 0) {
    return current
      ? `The delivery forecast stays ${formatCalendarDate(current, today)}.`
      : 'The delivery forecast does not move.';
  }
  const shift = plural(impact.forecastShiftWorkingDays, 'working day', 'working days');
  const from = current ? ` from ${formatCalendarDate(current, today)}` : '';
  const past =
    impact.projectEndImpactDays > 0
      ? `, ${plural(impact.projectEndImpactDays, 'working day', 'working days')} past the agreed ${formatCalendarDate(impact.plannedEndDate, today)}`
      : '';
  return `The delivery forecast moves${from} to ${formatCalendarDate(next, today)} (${shift} later${past}).`;
}

/**
 * What accepting does, shown before the decision: the waiting tasks that
 * would start before this one ends, where they would move, the milestones
 * that slip and the delivery forecast.
 */
export function DateChangeImpactSummary({
  impact,
  loading,
  today,
}: {
  readonly impact: DateChangeImpact | undefined;
  readonly loading: boolean;
  readonly today: string;
}) {
  if (loading) return <SkeletonText lines={2} />;
  if (!impact) return null;
  const quiet =
    impact.waitingTasks.length === 0 &&
    impact.dependentMoves.length === 0 &&
    impact.slippingMilestones.length === 0;
  return (
    <section
      aria-label="What accepting does"
      className="flex flex-col gap-2 rounded-md bg-sunken/50 px-3 py-2.5 type-body-sm"
    >
      {quiet ? (
        <p className="text-ink-muted">Nothing that waits on this task has to move.</p>
      ) : (
        <>
          {impact.waitingTasks.length > 0 && (
            <p className="text-ink">
              {impact.waitingTasks.length === 1
                ? '1 task waits for this one and would start before it ends:'
                : `${impact.waitingTasks.length} tasks wait for this one and would start before it ends:`}
            </p>
          )}
          {impact.dependentMoves.length > 0 && (
            <ul className="flex flex-col gap-1.5" aria-label="Where the waiting tasks would move">
              {impact.dependentMoves.map((move) => (
                <li key={move.taskId} className="flex flex-wrap items-center gap-x-2 text-ink">
                  <span className="min-w-0 truncate">{move.title}</span>
                  <span className="font-mono text-[0.75rem] text-ink-faint tabular-nums">
                    {move.currentDueDate ? formatCalendarDate(move.currentDueDate, today) : '—'}
                  </span>
                  <ArrowRight aria-hidden className="size-3.5 text-ink-faint" />
                  <span className="sr-only">to</span>
                  <span className="font-mono text-[0.75rem] text-ink tabular-nums">
                    {formatCalendarDate(move.proposedDueDate, today)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {impact.slippingMilestones.map((milestone) => (
            <p key={milestone.id} className="flex items-start gap-2 text-at-risk">
              <Milestone aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                “{milestone.name}” is due {formatCalendarDate(milestone.dueDate, today)}; its work
                would end {formatCalendarDate(milestone.forecastDueDate, today)} (
                {plural(milestone.slipWorkingDays, 'working day', 'working days')} late).
              </span>
            </p>
          ))}
        </>
      )}
      <p className="flex items-start gap-2 text-ink-muted">
        <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{deliveryLine(impact, today)}</span>
      </p>
      {impact.dependentMoves.length > 0 && (
        <p className="text-ink-faint">
          {impact.movingWaitingTasksNeedsScopeChange
            ? 'Moving the waiting tasks too would pass the agreed end, so that needs a scope change. Accepting only this task leaves them due before they can start.'
            : 'Accepting only this task leaves the waiting tasks due before they can start. The history keeps every old date.'}
        </p>
      )}
    </section>
  );
}
