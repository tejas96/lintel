import type { PersonCapacity } from '@lintel/api-contracts';
import {
  LOAD_LABELS,
  type LoadStatus,
  type PillTone,
  type StatusGlyphName,
} from '@lintel/design-system/web';
import { formatMinutes } from '@/lib/format/dates';

export type CapacityDay = PersonCapacity['days'][number];

interface LoadPresentation {
  readonly tone: PillTone;
  readonly glyph: StatusGlyphName;
  readonly label: string;
  /** Bar fill for booked time. */
  readonly bar: string;
  /** Text colour for the status word. */
  readonly text: string;
}

/** Load is a status: colour, glyph and word together (static classes for Tailwind). */
export const LOAD_PRESENTATION: Readonly<Record<LoadStatus, LoadPresentation>> = {
  available: {
    tone: 'done',
    glyph: 'ready',
    label: LOAD_LABELS.available,
    bar: 'bg-done-solid',
    text: 'text-ink-muted',
  },
  balanced: {
    tone: 'onTrack',
    glyph: 'onTrack',
    label: LOAD_LABELS.balanced,
    bar: 'bg-on-track-solid',
    text: 'text-on-track',
  },
  stretched: {
    tone: 'atRisk',
    glyph: 'atRisk',
    label: LOAD_LABELS.stretched,
    bar: 'bg-at-risk-solid',
    text: 'text-at-risk',
  },
  overloaded: {
    tone: 'overdue',
    glyph: 'overdue',
    label: LOAD_LABELS.overloaded,
    bar: 'bg-overdue-solid',
    text: 'text-overdue',
  },
};

/** "8h", "5.5h", "45m", "0h" — short enough for a day cell. */
export function formatHoursShort(minutes: number): string {
  if (minutes <= 0) return '0h';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export interface LoadSegments {
  readonly confirmed: number;
  readonly tentative: number;
  readonly blocked: number;
  /** Where available time ends, as a share of the bar (null when none is available). */
  readonly capacityMark: number | null;
  /** True when booked time runs past what the bar can show. */
  readonly overflow: boolean;
}

/**
 * Shares of one bar for a day: the bar spans up to twice the available time,
 * so overload is visible without one extreme day flattening every other bar.
 */
export function segmentsOf(day: CapacityDay): LoadSegments {
  const booked = day.confirmedMinutes + day.tentativeMinutes + day.blockedMinutes;
  const available = day.availableMinutes;
  const span = available > 0 ? Math.max(available, Math.min(booked, available * 2)) : booked;
  if (span <= 0) {
    return { confirmed: 0, tentative: 0, blocked: 0, capacityMark: null, overflow: false };
  }
  let room = span;
  const take = (minutes: number) => {
    const used = Math.min(minutes, room);
    room -= used;
    return used / span;
  };
  return {
    confirmed: take(day.confirmedMinutes),
    tentative: take(day.tentativeMinutes),
    blocked: take(day.blockedMinutes),
    capacityMark: available > 0 ? available / span : null,
    overflow: booked > span,
  };
}

/** What a cell says to a screen reader. */
export function describeDay(day: CapacityDay, dateLabel: string, holiday: string | null): string {
  if (holiday) return `${dateLabel}: ${holiday}, studio closed.`;
  if (!day.isWorkingDay && day.confirmedMinutes === 0) return `${dateLabel}: not a working day.`;
  const parts = [`${formatMinutes(day.confirmedMinutes)} confirmed`];
  if (day.tentativeMinutes > 0) parts.push(`${formatMinutes(day.tentativeMinutes)} tentative`);
  if (day.blockedMinutes > 0) parts.push(`${formatMinutes(day.blockedMinutes)} blocked`);
  const leave =
    day.leave === 'approved'
      ? ' On approved leave.'
      : day.leave === 'pending'
        ? ' Leave waiting for approval.'
        : '';
  return `${dateLabel}: ${parts.join(', ')} of ${formatMinutes(day.availableMinutes)} available. ${LOAD_PRESENTATION[day.status].label}.${leave}`;
}
