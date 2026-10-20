'use client';

import type { LeaveRequest } from '@lintel/api-contracts';
import {
  Avatar,
  Button,
  cn,
  layoutSpring,
  SkeletonText,
  StatusPill,
} from '@lintel/design-system/web';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';
import { swatchClass } from '@/features/tasks/task-presentation';
import { formatCalendarDate } from '@/lib/format/dates';
import { LeaveImpactSummary } from './leave-impact';
import { LEAVE_STATUS, useCancelLeave, useLeaveRequest } from './use-leave';

const STEP_WORDS = {
  waiting: 'Waiting its turn',
  pending: 'Deciding now',
  approved: 'Approved',
  rejected: 'Not approved',
  skipped: 'Not needed',
} as const;

/** One request: dates and status at a glance; the approval path and impact when opened. */
export function LeaveRequestItem({
  request,
  today,
}: {
  readonly request: LeaveRequest;
  readonly today: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const detail = useLeaveRequest(request.id, open);
  const cancel = useCancelLeave();
  const status = LEAVE_STATUS[request.status];
  const dates =
    request.startDate === request.endDate
      ? formatCalendarDate(request.startDate, today)
      : `${formatCalendarDate(request.startDate, today)} to ${formatCalendarDate(request.endDate, today)}`;
  return (
    <li className="rounded-lg border border-hairline bg-raised">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-lg p-4 text-left hover:bg-sunken/40"
      >
        <span
          aria-hidden
          className={cn('h-9 w-1 rounded-full', swatchClass(request.leaveType.colorIndex))}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-body font-medium text-ink">{dates}</span>
          <span className="type-body-sm text-ink-muted">
            {request.leaveType.name}, {request.durationLabel}
          </span>
        </span>
        <StatusPill tone={status.tone} glyph={status.glyph} label={status.label} size="sm" />
        <ChevronDown
          aria-hidden
          className={cn('size-4 text-ink-faint transition-transform', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={layoutSpring}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 border-t border-hairline p-4">
              <ol className="flex flex-col gap-2">
                {request.steps.map((step) => (
                  <li key={step.level} className="flex items-center gap-3 type-body-sm">
                    <span className="w-14 shrink-0 text-ink-faint">Step {step.level}</span>
                    {step.approver ? (
                      <Avatar
                        name={step.approver.fullName}
                        hue={step.approver.avatarHue}
                        size="xs"
                        decorative
                      />
                    ) : null}
                    <span className="text-ink">{step.approver?.fullName ?? 'Any approver'}</span>
                    <span className="text-ink-muted">{STEP_WORDS[step.status]}</span>
                    {step.note && <span className="text-ink-faint">“{step.note}”</span>}
                  </li>
                ))}
              </ol>
              {request.decisionNote && (
                <p className="type-body-sm text-ink">Note: {request.decisionNote}</p>
              )}
              {detail.isPending && <SkeletonText lines={3} />}
              {detail.data && <LeaveImpactSummary impact={detail.data.impact} today={today} />}
              {detail.data?.viewerCanCancel && (
                <Button
                  variant="danger"
                  size="sm"
                  className="self-start"
                  pending={cancel.isPending}
                  onClick={() => cancel.mutate({ id: request.id, version: detail.data.version })}
                >
                  Cancel this leave
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
