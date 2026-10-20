'use client';

import type { LeaveHandover } from '@lintel/api-contracts';
import { Avatar, type PillTone, type StatusGlyphName, StatusPill } from '@lintel/design-system/web';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TaskNumber } from '@/features/tasks/task-presentation';
import { useTask } from '@/features/tasks/use-task';
import { describeDue } from '@/lib/format/dates';
import { HandoverActions } from './handover-actions';
import type { useLeaveDecisionMutations } from './use-leave-decision';

const HANDOVER_STATUS: Readonly<
  Record<LeaveHandover['status'], { tone: PillTone; glyph: StatusGlyphName; label: string }>
> = {
  proposed: { tone: 'review', glyph: 'review', label: 'Waiting for an answer' },
  accepted: { tone: 'onTrack', glyph: 'onTrack', label: 'Accepted' },
  declined: { tone: 'atRisk', glyph: 'changes', label: 'Declined' },
  applied: { tone: 'done', glyph: 'done', label: 'Handed over' },
};

type HandoverMutation = ReturnType<typeof useLeaveDecisionMutations>['handover'];

interface LeaveHandoversProps {
  readonly handovers: readonly LeaveHandover[];
  readonly viewerId: string;
  readonly requesterName: string;
  readonly requesterId: string;
  readonly today: string;
  readonly mutation: HandoverMutation;
}

/** Who covers which task while the person is away, and each answer so far. */
export function LeaveHandovers({
  handovers,
  viewerId,
  requesterName,
  requesterId,
  today,
  mutation,
}: LeaveHandoversProps) {
  if (handovers.length === 0) {
    return (
      <p className="rounded-md border border-hairline bg-raised px-4 py-3 type-body-sm text-ink-muted">
        {requesterName} didn’t propose anyone to cover their work. A project manager can still
        reassign tasks from each task’s page.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {handovers.map((handover) => (
        <HandoverRow
          key={handover.id}
          handover={handover}
          viewerId={viewerId}
          requesterName={requesterName}
          requesterId={requesterId}
          today={today}
          mutation={mutation}
        />
      ))}
    </ul>
  );
}

function HandoverRow({
  handover,
  viewerId,
  requesterName,
  requesterId,
  today,
  mutation,
}: { readonly handover: LeaveHandover } & Omit<LeaveHandoversProps, 'handovers'>) {
  const status = HANDOVER_STATUS[handover.status];
  const isRecipient = handover.to?.id === viewerId;
  // Only a manager of the task's project may apply; the task detail says whether that is us.
  const task = useTask(handover.status === 'applied' ? null : handover.task.id);
  const canApply = task.data?.viewerCanManage === true;
  const due = handover.task.dueDate ? describeDue(handover.task.dueDate, today) : null;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/tasks/${handover.task.id}`}
            className="self-start rounded-sm type-body font-medium text-ink hover:underline"
          >
            <TaskNumber value={handover.task.number} className="mr-1.5 font-normal" />
            {handover.task.title}
          </Link>
          {due && (
            <p className={due.late ? 'type-body-sm text-overdue' : 'type-body-sm text-ink-muted'}>
              {due.text}
            </p>
          )}
        </div>
        <StatusPill
          tone={status.tone}
          glyph={status.glyph}
          label={status.label}
          size="sm"
          className="self-start"
        />
      </div>
      <p className="flex flex-wrap items-center gap-2 type-body-sm text-ink-muted">
        <span>{requesterName}</span>
        <ArrowRight aria-label="hands over to" className="size-3.5 text-ink-faint" />
        {handover.to ? (
          <span className="inline-flex items-center gap-1.5 text-ink">
            <Avatar name={handover.to.fullName} hue={handover.to.avatarHue} size="xs" decorative />
            {isRecipient ? 'You' : handover.to.fullName}
          </span>
        ) : (
          <span className="text-ink-faint">nobody chosen yet</span>
        )}
      </p>
      {handover.note && (
        <p className="rounded-md bg-sunken/70 px-3 py-2 type-body-sm text-ink">{handover.note}</p>
      )}
      <HandoverActions
        handover={handover}
        isRecipient={isRecipient}
        canApply={canApply}
        excludeIds={[requesterId]}
        mutation={mutation}
      />
    </li>
  );
}
