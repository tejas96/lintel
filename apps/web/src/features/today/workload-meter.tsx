'use client';

import type { WorkQueue } from '@lintel/api-contracts';
import {
  Card,
  easing,
  type PillTone,
  type StatusGlyphName,
  StatusPill,
  seconds,
} from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { formatMinutes } from '@/lib/format/dates';

type LoadStatus = WorkQueue['workload']['status'];

const LOAD: Readonly<
  Record<LoadStatus, { tone: PillTone; label: string; glyph: StatusGlyphName; bar: string }>
> = {
  available: { tone: 'neutral', label: 'Has room', glyph: 'ready', bar: 'bg-done-solid' },
  balanced: { tone: 'onTrack', label: 'Balanced', glyph: 'onTrack', bar: 'bg-on-track-solid' },
  stretched: { tone: 'atRisk', label: 'Stretched', glyph: 'atRisk', bar: 'bg-at-risk-solid' },
  overloaded: { tone: 'overdue', label: 'Overloaded', glyph: 'offTrack', bar: 'bg-overdue-solid' },
};

/** Today's committed work against the time available, with the capacity line marked. */
export function WorkloadMeter({ workload }: { readonly workload: WorkQueue['workload'] }) {
  const load = LOAD[workload.status];
  const scale = Math.max(workload.availableMinutesToday, workload.committedMinutesToday, 1) * 1.08;
  const committedShare = Math.min(1, workload.committedMinutesToday / scale);
  const capacityAt = workload.availableMinutesToday / scale;
  const summary = `${formatMinutes(workload.committedMinutesToday)} planned of ${formatMinutes(workload.availableMinutesToday)} available`;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="type-title-md text-ink">Today’s load</h2>
          <p className="type-body-sm text-ink-faint">
            {workload.onLeaveToday ? 'You’re on leave today. Nothing is expected of you.' : summary}
          </p>
        </div>
        <StatusPill tone={load.tone} label={load.label} glyph={load.glyph} size="sm" />
      </div>
      {!workload.onLeaveToday && (
        <div aria-hidden className="relative h-2.5 rounded-full bg-sunken">
          <motion.span
            className={`absolute inset-y-0 left-0 origin-left rounded-full ${load.bar}`}
            style={{ width: `${committedShare * 100}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: seconds('data'), ease: easing('outExpo') }}
          />
          <span
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink"
            style={{ left: `${capacityAt * 100}%` }}
            title="Time available today"
          />
        </div>
      )}
    </Card>
  );
}
