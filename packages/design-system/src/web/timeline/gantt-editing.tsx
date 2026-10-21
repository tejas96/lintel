'use client';

import { motion } from 'motion/react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { PillTone } from '../data/status-pill';
import { daysFrom, shortDate } from '../lib/calendar-math';
import { cn } from '../lib/cn';
import { layoutSpring } from '../motion/presets';
import { BAR_TONES } from './gantt-bar';
import type { TimelineScale } from './timeline-scale';

/** What a pointer grabbed: the whole bar (move), or one of its ends (resize). */
export type GanttDragPart = 'move' | 'start' | 'end';

export type GanttEditState = 'idle' | 'dragging' | 'proposed';

interface GanttEditableBarProps {
  readonly scale: TimelineScale;
  readonly start: string;
  readonly end: string;
  readonly tone: PillTone;
  readonly title: string;
  readonly statusLabel: string;
  readonly progress?: number | undefined;
  /** Where the bar was before a proposed move, drawn as a faint dashed outline. */
  readonly from?: { readonly start: string; readonly end: string } | undefined;
  readonly state: GanttEditState;
  /** Identifies the bar in the page (`data-gantt-key`), e.g. to scroll it into view. */
  readonly barKey?: string | undefined;
  /** Extra words for assistive technology, e.g. the keyboard instructions. */
  readonly describedBy?: string | undefined;
  readonly onPointerDownPart: (part: GanttDragPart, event: PointerEvent<HTMLElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly onSelect: () => void;
}

function span(scale: TimelineScale, start: string, end: string) {
  const left = scale.x(start);
  return { left, width: Math.max(scale.dayWidth, scale.x(end) + scale.dayWidth - left) };
}

const HANDLE =
  'absolute inset-y-0 z-10 flex w-2.5 cursor-col-resize items-center justify-center touch-none ' +
  'opacity-0 transition-opacity duration-(--duration-fast) group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100';

/**
 * A task bar the project manager can move (drag it) or resize (drag an end).
 * While dragged it follows the pointer day by day; a proposed position slides
 * into place with the layout spring, with a dashed outline where it was, so
 * the knock-on of a change is seen before it is saved.
 */
export function GanttEditableBar(props: GanttEditableBarProps) {
  const { scale, start, end, tone, title, statusLabel, progress, from, state } = props;
  const box = span(scale, start, end);
  const days = daysFrom(start, end) + 1;
  const dates = `${shortDate(start)} – ${shortDate(end)}`;
  return (
    <>
      {from && (from.start !== start || from.end !== end) && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-2.5 h-6 rounded-md border border-dashed border-ink-faint/60"
          style={span(scale, from.start, from.end)}
        />
      )}
      <motion.button
        type="button"
        layout={state === 'dragging' ? false : 'position'}
        onClick={props.onSelect}
        onKeyDown={props.onKeyDown}
        onPointerDown={(event) => props.onPointerDownPart('move', event)}
        aria-label={`${title}, ${statusLabel}, ${dates}, ${days} days`}
        aria-describedby={props.describedBy}
        data-gantt-key={props.barKey}
        className={cn(
          'group/bar absolute top-2.5 flex h-6 touch-pan-y items-center rounded-md border text-left',
          state === 'dragging'
            ? 'z-20 cursor-grabbing shadow-e3 ring-2 ring-accent'
            : 'cursor-grab shadow-e1 transition-shadow hover:shadow-e2',
          state === 'proposed' && 'z-10 ring-2 ring-accent/60',
          BAR_TONES[tone],
        )}
        style={box}
        transition={{ layout: layoutSpring }}
      >
        <span
          className={cn(HANDLE, '-left-1')}
          onPointerDown={(event) => {
            event.stopPropagation();
            props.onPointerDownPart('start', event);
          }}
        >
          <span className="h-3 w-0.5 rounded-full bg-current opacity-70" />
        </span>
        {progress !== undefined && progress > 0 && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-l-md bg-current opacity-15"
            style={{ width: `${Math.min(1, progress) * 100}%` }}
          />
        )}
        <span className="relative truncate px-2 type-label">{box.width > 72 ? title : ''}</span>
        <span
          className={cn(HANDLE, '-right-1')}
          onPointerDown={(event) => {
            event.stopPropagation();
            props.onPointerDownPart('end', event);
          }}
        >
          <span className="h-3 w-0.5 rounded-full bg-current opacity-70" />
        </span>
        {state === 'dragging' && (
          <span className="pointer-events-none absolute -top-6 left-0 rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.6875rem] whitespace-nowrap text-canvas shadow-e2">
            {dates}
          </span>
        )}
      </motion.button>
    </>
  );
}

export interface GanttDateLine {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  /** "agreed": the committed date, quiet and dashed; "proposed": where a change would put it. */
  readonly kind: 'agreed' | 'proposed';
}

/**
 * Full-height lines for dates that matter to a change (the agreed end and a
 * proposed new end). A proposed line slides to its date.
 */
export function GanttDateLines({
  scale,
  lines,
}: {
  readonly scale: TimelineScale;
  readonly lines: readonly GanttDateLine[];
}) {
  if (lines.length === 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 left-(--gantt-label)"
    >
      {lines.map((line) => (
        <motion.span
          key={line.id}
          className={cn(
            'absolute inset-y-0 w-0',
            line.kind === 'agreed'
              ? 'border-l border-dashed border-ink-faint'
              : 'border-l-2 border-at-risk-solid',
          )}
          initial={false}
          animate={{ left: scale.x(line.date) + scale.dayWidth }}
          transition={layoutSpring}
        >
          <span
            className={cn(
              'absolute bottom-2 left-1.5 rounded-sm px-1.5 py-0.5 type-label whitespace-nowrap',
              line.kind === 'agreed' ? 'bg-surface text-ink-muted' : 'bg-at-risk-tint text-at-risk',
            )}
          >
            {line.label}
          </span>
        </motion.span>
      ))}
    </div>
  );
}
