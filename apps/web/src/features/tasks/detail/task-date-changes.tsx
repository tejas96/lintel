'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Button, cn } from '@lintel/design-system/web';
import { CalendarClock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AskDateChangeSheet } from './ask-date-change-sheet';
import { DateChangeRequestCard } from './date-change-request-card';
import { DetailSection } from './detail-section';
import { useTaskDateChanges } from './use-date-changes';

/**
 * New dates: the owner or a collaborator asks with a reason, the project
 * manager accepts or declines here, and earlier requests stay as history.
 * Opened from the approvals queue or a risk card, the section scrolls into
 * view; the late-start callout opens the sheet through `asking`.
 */
export function TaskDateChanges({
  task,
  today,
  asking,
  onAskingChange,
}: {
  readonly task: TaskDetail;
  readonly today: string;
  readonly asking: boolean;
  readonly onAskingChange: (asking: boolean) => void;
}) {
  const changes = useTaskDateChanges(task.id);
  const [showHistory, setShowHistory] = useState(false);
  const linked = useSearchParams().get('dateRequest');
  const section = useRef<HTMLDivElement>(null);
  const data = changes.data;
  const open = data?.requests.find((request) => request.status === 'open') ?? null;
  const past = data?.requests.filter((request) => request.status !== 'open') ?? [];
  useEffect(() => {
    if (linked && open?.id === linked) section.current?.scrollIntoView({ block: 'center' });
  }, [linked, open?.id]);
  if (!data) return null;
  if (!open && past.length === 0 && !data.viewerCanRequest) return null;
  return (
    <div
      ref={section}
      className={cn(
        'scroll-mt-6 rounded-lg',
        linked && open?.id === linked && 'ring-2 ring-accent/30 ring-offset-4 ring-offset-canvas',
      )}
    >
      <DetailSection
        title="New date"
        action={
          data.viewerCanRequest ? (
            <Button
              size="sm"
              variant="quiet"
              leadingIcon={<CalendarClock aria-hidden />}
              onClick={() => onAskingChange(true)}
            >
              Ask for a new date
            </Button>
          ) : undefined
        }
      >
        {open ? (
          <DateChangeRequestCard request={open} today={today} />
        ) : (
          <p className="type-body-sm text-ink-faint">
            {data.requestUnavailableReason ??
              (data.viewerCanRequest
                ? 'Won’t make the date? Ask the project manager for a new one, with the reason.'
                : 'No new date is waiting for a decision.')}
          </p>
        )}
        {past.length > 0 && (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="quiet"
              aria-expanded={showHistory}
              className="self-start"
              onClick={() => setShowHistory((value) => !value)}
            >
              {showHistory ? 'Hide earlier requests' : `Earlier requests (${past.length})`}
            </Button>
            {showHistory &&
              past.map((request) => (
                <DateChangeRequestCard key={request.id} request={request} today={today} />
              ))}
          </div>
        )}
      </DetailSection>
      <AskDateChangeSheet task={task} today={today} open={asking} onOpenChange={onAskingChange} />
    </div>
  );
}
