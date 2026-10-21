'use client';

import type { PlanPreview } from '@lintel/api-contracts';
import { cn, easing, seconds } from '@lintel/design-system/web';
import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { daysBetween, formatCalendarDate, formatWeekdayShort } from '@/lib/format/dates';

interface PlanSummaryProps {
  readonly preview: PlanPreview | undefined;
  /** The template's own plan, to show how the changes move the end date. */
  readonly template: PlanPreview | undefined;
  readonly updating: boolean;
  readonly today: string;
}

/** A date that slides in when it changes, so the eye catches what moved. */
function ChangingDate({ date, today }: { readonly date: string; readonly today: string }) {
  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={date}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: seconds('base'), ease: easing('outQuint') }}
          className="col-start-1 row-start-1 whitespace-nowrap"
        >
          <span className="mr-2 type-body text-ink-faint">{formatWeekdayShort(date)}</span>
          {formatCalendarDate(date, today)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function endDelta(preview: PlanPreview, template: PlanPreview | undefined): string | null {
  if (!template) return null;
  const days = daysBetween(template.plannedEndDate, preview.plannedEndDate);
  if (days === 0) return 'Ends when the template plan does';
  const amount = `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
  return days > 0
    ? `${amount} later than the template plan`
    : `${amount} sooner than the template plan`;
}

/** Start, end and size of the tailored plan, with the end date's change against the template. */
export function PlanSummary({ preview, template, updating, today }: PlanSummaryProps) {
  if (!preview) return null;
  const delta = endDelta(preview, template);
  const stats = [
    { label: 'working days', value: preview.workingDays },
    { label: preview.tasks.length === 1 ? 'task' : 'tasks', value: preview.tasks.length },
    { label: preview.stages.length === 1 ? 'stage' : 'stages', value: preview.stages.length },
  ];
  return (
    <section
      aria-label="The plan at a glance"
      aria-busy={updating}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5 shadow-e1 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <p className="type-overline text-ink-faint uppercase">The plan</p>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 type-display-md text-ink">
          <ChangingDate date={preview.plannedStartDate} today={today} />
          <ArrowRight aria-label="to" className="size-5 self-center text-ink-faint" />
          <ChangingDate date={preview.plannedEndDate} today={today} />
        </p>
        <p
          aria-live="polite"
          className={cn(
            'type-body-sm transition-opacity duration-(--duration-fast)',
            updating ? 'text-ink-faint opacity-70' : 'text-ink-muted',
          )}
        >
          {updating ? 'Updating the dates…' : delta}
        </p>
      </div>
      <dl className="flex gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col">
            <dd className="order-1 font-mono text-[1.25rem] leading-7 text-ink tabular-nums">
              {stat.value}
            </dd>
            <dt className="order-2 type-label text-ink-faint">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
