'use client';

import type { WorkloadReport } from '@lintel/api-contracts';
import { cn, easing, seconds, Tooltip, useCalmMotion } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { LOAD_PRESENTATION } from '@/features/capacity/load-presentation';
import { formatHours, formatRate, periodName, periodTick } from './report-format';
import { LegendItem } from './report-parts';

const HEIGHT = 176;

type Period = WorkloadReport['byPeriod'][number];

/** One period as a gauge: the track is available time, the fill planned work, the tick logged time. */
function Gauge({
  period,
  max,
  tracking,
  index,
}: {
  readonly period: Period;
  readonly max: number;
  readonly tracking: boolean;
  readonly index: number;
}) {
  const calm = useCalmMotion();
  const toPx = (minutes: number) => (minutes / max) * HEIGHT;
  const available = Math.max(2, toPx(period.availableMinutes));
  const planned = period.plannedMinutes > 0 ? Math.max(3, toPx(period.plannedMinutes)) : 0;
  const logged = toPx(period.loggedMinutes);
  const motionProps = (delay: number) => ({
    initial: calm ? false : { scaleY: 0 },
    animate: { scaleY: 1 },
    transition: { duration: seconds('data'), ease: easing('outExpo'), delay },
  });
  return (
    <span className="relative flex h-full w-full max-w-9 items-end justify-center">
      <motion.span
        className="absolute bottom-0 w-full origin-bottom rounded-t-[5px] border border-b-0 border-rule bg-sunken/80"
        style={{ height: available }}
        {...motionProps(index * 0.03)}
      />
      {planned > 0 && (
        <motion.span
          className={cn(
            'absolute bottom-0 w-[56%] origin-bottom rounded-t-[3px]',
            LOAD_PRESENTATION[period.status].bar,
          )}
          style={{ height: planned }}
          {...motionProps(0.08 + index * 0.03)}
        />
      )}
      {tracking && period.loggedMinutes > 0 && (
        <motion.span
          className="absolute left-0 h-[2px] w-full rounded-full bg-ink"
          style={{ bottom: logged }}
          initial={calm ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: seconds('fast'), delay: seconds('data') }}
        />
      )}
    </span>
  );
}

/**
 * Available, planned and logged hours per period. Planned work takes the
 * colour of its load status, so a stretched or overloaded period reads at a
 * glance; every period has a tooltip and an accessible label with the hours.
 */
export function WorkloadChart({
  data,
  today,
}: {
  readonly data: WorkloadReport;
  readonly today: string;
}) {
  const tracking = data.workTrackingEnabled;
  const max = Math.max(
    60,
    ...data.byPeriod.flatMap((period) => [
      period.availableMinutes,
      period.plannedMinutes,
      tracking ? period.loggedMinutes : 0,
    ]),
  );
  const every = Math.ceil(data.byPeriod.length / 5);
  return (
    <figure className="flex flex-col gap-3">
      <ul
        aria-label={`Available, planned${tracking ? ' and logged' : ''} hours by ${data.granularity}`}
        className="flex items-end gap-1.5 border-b border-hairline sm:gap-3"
        style={{ height: HEIGHT }}
      >
        {data.byPeriod.map((period, index) => {
          const words = `${periodName(period, data.granularity, today)}: ${formatHours(period.plannedMinutes)} planned of ${formatHours(period.availableMinutes)} available (${formatRate(period.utilization)}, ${LOAD_PRESENTATION[period.status].label.toLowerCase()})${tracking ? `, ${formatHours(period.loggedMinutes)} logged` : ''}`;
          return (
            <li key={period.start} className="flex h-full min-w-3 flex-1 justify-center">
              <Tooltip content={words}>
                <button
                  type="button"
                  aria-label={words}
                  className="flex h-full w-full justify-center rounded-sm outline-offset-2"
                >
                  <Gauge period={period} max={max} tracking={tracking} index={index} />
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <div aria-hidden className="flex gap-1.5 sm:gap-3">
        {data.byPeriod.map((period, index) => (
          <span
            key={period.start}
            className="min-w-3 flex-1 text-center font-mono text-[0.6875rem] whitespace-nowrap text-ink-faint tabular-nums"
          >
            {index % every === 0 ? periodTick(period, data.granularity, today) : ''}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-2">
        <LegendItem swatch="border border-rule bg-sunken">Available</LegendItem>
        <LegendItem swatch="bg-on-track-solid">Planned, coloured by load</LegendItem>
        {tracking && <LegendItem swatch="h-0.5 rounded-full bg-ink">Logged</LegendItem>}
      </figcaption>
    </figure>
  );
}
