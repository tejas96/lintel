'use client';

import type { LeaveRequest } from '@lintel/api-contracts';
import { Avatar, cn, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { ChevronRight, Siren } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { swatchClass } from '@/features/tasks/task-presentation';
import { formatLeaveDates, LEAVE_STATUS } from './use-leave';

interface LeaveRequestItemProps {
  readonly request: LeaveRequest;
  readonly today: string;
  /** Show who asked (lists of other people's leave). */
  readonly showPerson?: boolean;
  readonly index?: number;
}

/** One request at a glance; the whole row opens its page. */
export function LeaveRequestItem({
  request,
  today,
  showPerson = false,
  index = 0,
}: LeaveRequestItemProps) {
  const status = LEAVE_STATUS[request.status];
  const dates = formatLeaveDates(request.startDate, request.endDate, today);
  return (
    <motion.li
      {...listItemEnter(index)}
      className="group relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-hairline bg-raised p-4 transition-[border-color,box-shadow] hover:border-rule hover:shadow-e1"
    >
      <span
        aria-hidden
        className={cn('h-9 w-1 rounded-full', swatchClass(request.leaveType.colorIndex))}
      />
      {showPerson && (
        <Avatar name={request.user.fullName} hue={request.user.avatarHue} size="sm" decorative />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/leave/${request.id}`}
          className="lt-stretched-link truncate rounded-sm type-body font-medium text-ink"
        >
          {showPerson ? `${request.user.fullName}, ${dates}` : dates}
        </Link>
        <span className="flex items-center gap-1.5 type-body-sm text-ink-muted">
          {request.isUrgentAbsence && <Siren aria-label="Urgent absence" className="size-3.5" />}
          {request.leaveType.name}, {request.durationLabel}
        </span>
      </span>
      <StatusPill tone={status.tone} glyph={status.glyph} label={status.label} size="sm" />
      <ChevronRight
        aria-hidden
        className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5"
      />
    </motion.li>
  );
}
