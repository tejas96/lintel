'use client';

import type { ReschedulePreview } from '@lintel/api-contracts';
import { Button, Field, Input, sheetTransition } from '@lintel/design-system/web';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { formatCalendarDate } from '@/lib/format/dates';
import { endNote, knockOnSummary, RescheduleDetails } from './reschedule-effects';

interface ReschedulePanelProps {
  readonly taskTitle: string;
  readonly preview: ReschedulePreview | undefined;
  readonly previewError: unknown;
  readonly saving: boolean;
  readonly saveError: unknown;
  readonly today: string;
  readonly onCancel: () => void;
  readonly onApply: (reason: string | null) => void;
  readonly onPropose: (title: string, description: string) => void;
}

const dates = (start: string | null, end: string, today: string) =>
  start && start !== end
    ? `${formatCalendarDate(start, today)} – ${formatCalendarDate(end, today)}`
    : formatCalendarDate(end, today);

function ReviewHeader({
  ref,
  preview,
  waiting,
  fallbackTitle,
  today,
}: {
  readonly ref: RefObject<HTMLHeadingElement | null>;
  readonly preview: ReschedulePreview | undefined;
  readonly waiting: boolean;
  readonly fallbackTitle: string;
  readonly today: string;
}) {
  const own = preview?.moves.find((move) => !move.isDownstream);
  const scope = preview?.requiresScopeChange ?? false;
  return (
    <header className="flex items-start gap-3">
      <CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3
          id="reschedule-heading"
          ref={ref}
          tabIndex={-1}
          className="type-title-md text-ink outline-none"
        >
          {own
            ? `“${own.title}” to ${dates(own.proposedStartDate, own.proposedDueDate, today)}`
            : `Moving “${fallbackTitle}”`}
        </h3>
        <p aria-live="polite" className="flex items-start gap-1.5 type-body-sm text-ink-muted">
          {scope && <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-at-risk" />}
          <span className={scope ? 'text-ink' : undefined}>
            {preview
              ? `${knockOnSummary(preview)} ${endNote(preview, today)}`
              : waiting
                ? 'Working out what follows…'
                : null}
          </span>
        </p>
      </div>
    </header>
  );
}

/**
 * A compact bar that floats over the page while a dragged change is reviewed:
 * what moves, what follows (details one press away), the agreed end, a
 * reason, and save or put back. A move of the agreed end becomes a scope
 * change proposal, so it can be approved first.
 */
export function ReschedulePanel(props: ReschedulePanelProps) {
  const { preview, today } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState(`Move “${props.taskTitle}”`);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const scope = preview?.requiresScopeChange ?? false;
  const asksReason = scope || (preview?.needsReason ?? false);
  const error = props.previewError ?? props.saveError;
  const reasoned = reason.trim().length >= 3;
  const canSave = preview !== undefined && (!asksReason || reasoned) && (!scope || title.trim());
  const save = () =>
    scope
      ? props.onPropose(title.trim(), reason.trim())
      : props.onApply(reason.trim() === '' ? null : reason.trim());
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={sheetTransition}
      aria-labelledby="reschedule-heading"
      className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto rounded-xl border border-accent/30 bg-raised p-4 shadow-e4"
    >
      <ReviewHeader
        ref={heading}
        preview={preview}
        waiting={!preview && !error}
        fallbackTitle={props.taskTitle}
        today={today}
      />
      {preview && <RescheduleDetails preview={preview} today={today} />}
      {error !== null && error !== undefined && (
        <p role="alert" className="type-body-sm text-overdue">
          {describeError(error, { resource: 'item', noun: 'task' }).message}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {preview && scope && (
          <Field label="Scope change" className="min-w-[12rem] flex-1">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </Field>
        )}
        {preview && asksReason && (
          <Field
            label={scope ? 'Why is it needed?' : 'Why do the dates move?'}
            hint={scope ? undefined : 'Kept in the history; the owners are told.'}
            className="min-w-[14rem] flex-[2]"
          >
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder={scope ? 'For approvers' : 'For example: site opens a day later'}
            />
          </Field>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="quiet" onClick={props.onCancel}>
            Put it back
          </Button>
          <Button variant="primary" disabled={!canSave} pending={props.saving} onClick={save}>
            {scope ? 'Propose scope change' : 'Apply new dates'}
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
