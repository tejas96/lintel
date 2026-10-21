'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Button, cn } from '@lintel/design-system/web';
import { CalendarClock, Hand, Play, TriangleAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { formatCalendarDate } from '@/lib/format/dates';
import { useTaskActions } from '../use-task-actions';
import { startMove } from '../work-tracking';

/**
 * Shown while a task that could start now has passed its planned start
 * (Ready, start before today, the server allows the move to In progress), and
 * highlighted when the late-start nudge brought the person here: start it,
 * report what is in the way, or ask for a new date. Every button is one the
 * server already allows.
 */
export function LateStartCallout({
  task,
  today,
  canAskForDate,
  onReportBlocker,
  onAskForDate,
}: {
  readonly task: TaskDetail;
  readonly today: string;
  readonly canAskForDate: boolean;
  readonly onReportBlocker: () => void;
  readonly onAskForDate: () => void;
}) {
  const actions = useTaskActions();
  const nudged = useSearchParams().get('nudge') === 'late-start';
  if (task.status !== 'ready' || !task.plannedStartDate || task.plannedStartDate >= today) {
    return null;
  }
  // Like the late-start nudge: only work that could start now (prerequisites done).
  const start = startMove(task.status, task.transitions);
  if (!start) return null;
  const canBlock = task.transitions.some((option) => option.allowed && option.to === 'blocked');
  const begin = () =>
    task.workTrackingEnabled
      ? actions.startWork.mutate(task.id)
      : actions.transition.mutate({
          taskId: task.id,
          to: 'in_progress',
          note: null,
          version: task.version,
        });
  return (
    <section
      aria-labelledby="late-start-title"
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-at-risk/30 bg-at-risk-tint p-5 sm:flex-row sm:items-center sm:justify-between',
        nudged && 'shadow-e2 ring-2 ring-accent/25 ring-offset-2 ring-offset-canvas',
      )}
    >
      <div className="flex min-w-0 gap-3">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-at-risk" />
        <div className="min-w-0">
          <h2 id="late-start-title" className="type-title-md text-ink">
            Planned to start {formatCalendarDate(task.plannedStartDate, today)}, not started yet
          </h2>
          <p className="mt-1 type-body-sm text-ink-muted">
            Start it now, say what is in the way, or ask the project manager for a new date.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Play aria-hidden />}
          pending={actions.startWork.isPending || actions.transition.isPending}
          onClick={begin}
        >
          Start now
        </Button>
        {canBlock && (
          <Button size="sm" leadingIcon={<Hand aria-hidden />} onClick={onReportBlocker}>
            Report a blocker
          </Button>
        )}
        {canAskForDate && (
          <Button size="sm" leadingIcon={<CalendarClock aria-hidden />} onClick={onAskForDate}>
            Ask for a new date
          </Button>
        )}
      </div>
    </section>
  );
}
