'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Button, cn } from '@lintel/design-system/web';
import { ArrowRightLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AskReassignmentSheet } from './ask-reassignment-sheet';
import { DetailSection } from './detail-section';
import { ReassignmentRequestCard } from './reassignment-request-card';
import { useTaskReassignments } from './use-reassignments';

/**
 * Handing a task over: the owner or a collaborator asks, the project manager
 * decides here, and earlier requests stay visible as history. Opened from the
 * approvals queue, the section scrolls into view.
 */
export function TaskReassignment({ task }: { readonly task: TaskDetail }) {
  const reassignments = useTaskReassignments(task.id);
  const [asking, setAsking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const linked = useSearchParams().get('reassignment');
  const section = useRef<HTMLDivElement>(null);
  const data = reassignments.data;
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
        title="Handover"
        action={
          data.viewerCanRequest ? (
            <Button
              size="sm"
              variant="quiet"
              leadingIcon={<ArrowRightLeft aria-hidden />}
              onClick={() => setAsking(true)}
            >
              Ask to hand over
            </Button>
          ) : undefined
        }
      >
        {open ? (
          <ReassignmentRequestCard request={open} />
        ) : data.viewerCanRequest || data.requestUnavailableReason ? (
          <p className="type-body-sm text-ink-faint">
            {data.requestUnavailableReason ??
              'Can’t finish this one? Ask the project manager to give it to someone else.'}
          </p>
        ) : (
          <p className="type-body-sm text-ink-faint">No handover is waiting for a decision.</p>
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
              past.map((request) => <ReassignmentRequestCard key={request.id} request={request} />)}
          </div>
        )}
      </DetailSection>
      <AskReassignmentSheet
        task={{ id: task.id, title: task.title, ownerId: task.owner?.id ?? null }}
        open={asking}
        onOpenChange={setAsking}
      />
    </div>
  );
}
