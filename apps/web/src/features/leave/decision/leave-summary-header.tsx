'use client';

import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { Avatar, Badge, cn, StatusPill } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { ChevronLeft, Siren } from 'lucide-react';
import Link from 'next/link';
import { swatchClass } from '@/features/tasks/task-presentation';
import { formatRelativeInstant } from '@/lib/format/dates';
import { formatLeaveDates, LEAVE_STATUS } from '../use-leave';

interface LeaveSummaryHeaderProps {
  readonly request: LeaveRequestDetail;
  readonly today: string;
  /** True when the signed-in person asked for this leave. */
  readonly isRequester: boolean;
}

/** Who is away, when, for how long, and where the request stands. */
export function LeaveSummaryHeader({ request, today, isRequester }: LeaveSummaryHeaderProps) {
  const status = LEAVE_STATUS[request.status];
  const who = isRequester ? 'Your' : `${request.user.fullName}’s`;
  return (
    <header className="flex flex-col gap-5">
      <Link
        href="/leave"
        className="inline-flex items-center gap-1 self-start rounded-sm type-body-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Leave
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex items-center gap-2.5 type-body-sm text-ink-muted">
            <Avatar
              name={request.user.fullName}
              hue={request.user.avatarHue}
              size="sm"
              decorative
            />
            <span className="min-w-0">
              <span className="font-medium text-ink">{request.user.fullName}</span>
              <span className="text-ink-faint">
                , {request.user.designation ?? ROLE_LABELS[request.user.role]}
              </span>
            </span>
          </p>
          <h1 className="type-display-md text-balance text-ink md:type-display-lg">
            {who} {request.leaveType.name.toLowerCase()},{' '}
            <span className="whitespace-nowrap">
              {formatLeaveDates(request.startDate, request.endDate, today)}
            </span>
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 type-body text-ink-muted">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={cn('size-2 rounded-[2px]', swatchClass(request.leaveType.colorIndex))}
              />
              {request.durationLabel}
              {request.dayPortion !== 'full' &&
                (request.dayPortion === 'first_half' ? ', morning' : ', afternoon')}
            </span>
            <span className="text-ink-faint">
              {request.isUrgentAbsence ? 'Recorded' : 'Requested'}{' '}
              {formatRelativeInstant(request.createdAt)}
            </span>
            {request.isUrgentAbsence && (
              <Badge variant="soft">
                <Siren aria-hidden className="size-3.5" />
                Urgent absence
              </Badge>
            )}
          </p>
        </div>
        <StatusPill
          tone={status.tone}
          glyph={status.glyph}
          label={status.label}
          className="self-start"
        />
      </div>
      {request.reason && (
        <blockquote className="max-w-prose border-l-2 border-rule pl-4 font-display text-[1.125rem] leading-7 text-ink">
          {request.reason}
        </blockquote>
      )}
      {request.status === 'info_requested' && request.decisionNote && (
        <div className="max-w-prose rounded-md border border-at-risk-solid/30 bg-at-risk-tint/50 px-4 py-3">
          <p className="type-label text-at-risk">
            {isRequester ? 'Your approver asked' : 'Question asked'}
          </p>
          <p className="mt-1 type-body text-ink">{request.decisionNote}</p>
        </div>
      )}
    </header>
  );
}
