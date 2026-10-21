'use client';

import type { ReschedulePreview } from '@lintel/api-contracts';
import { ArrowRight, Milestone } from 'lucide-react';
import { formatCalendarDate } from '@/lib/format/dates';

/** "2 tasks wait for it and move too." */
export function knockOnSummary(preview: ReschedulePreview): string {
  const count = preview.moves.filter((move) => move.isDownstream).length;
  if (count === 0) return 'Nothing else has to move.';
  return count === 1
    ? '1 task waits for it and moves too.'
    : `${count} tasks wait for it and move too.`;
}

/** The agreed end: unchanged, or how far it would move (which needs a scope change). */
export function endNote(preview: ReschedulePreview, today: string): string {
  const planned = formatCalendarDate(preview.plannedEndDate, today);
  if (!preview.requiresScopeChange) return `The agreed end stays ${planned}.`;
  const forecast = preview.forecastEndDate
    ? formatCalendarDate(preview.forecastEndDate, today)
    : 'later';
  const days = preview.projectEndImpactDays;
  return `The agreed end would move from ${planned} to ${forecast} (${days} working ${days === 1 ? 'day' : 'days'}), so it needs a scope change.`;
}

/**
 * The tasks that move with the change and the milestones that would slip,
 * folded away until asked for (the bars on the chart already show them).
 */
export function RescheduleDetails({
  preview,
  today,
}: {
  readonly preview: ReschedulePreview;
  readonly today: string;
}) {
  const knockOn = preview.moves.filter((move) => move.isDownstream);
  const milestones = preview.slippingMilestones;
  if (knockOn.length === 0 && milestones.length === 0) return null;
  return (
    <details className="group rounded-md bg-sunken/50 px-3 py-2 type-body-sm">
      <summary className="cursor-pointer rounded-sm text-ink-muted marker:text-ink-faint">
        {[
          knockOn.length > 0
            ? `${knockOn.length} ${knockOn.length === 1 ? 'task' : 'tasks'} follow`
            : null,
          milestones.length > 0
            ? `${milestones.length} ${milestones.length === 1 ? 'milestone' : 'milestones'} would slip`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {knockOn.map((move) => (
          <li key={move.taskId} className="flex flex-wrap items-center gap-x-2 text-ink">
            <span className="min-w-0 truncate">{move.title}</span>
            <span className="font-mono text-[0.75rem] text-ink-faint tabular-nums">
              {move.currentDueDate ? formatCalendarDate(move.currentDueDate, today) : '—'}
            </span>
            <ArrowRight aria-label="to" className="size-3.5 text-ink-faint" />
            <span className="font-mono text-[0.75rem] text-ink tabular-nums">
              {formatCalendarDate(move.proposedDueDate, today)}
            </span>
          </li>
        ))}
        {milestones.map((milestone) => (
          <li key={milestone.id} className="flex items-start gap-2 text-at-risk">
            <Milestone aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              “{milestone.name}” is due {formatCalendarDate(milestone.dueDate, today)}; its last
              task would end {formatCalendarDate(milestone.latestTaskDueDate, today)}.
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
