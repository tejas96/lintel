'use client';

import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { ErrorState, pageEnter, Skeleton, SkeletonGroup } from '@lintel/design-system/web';
import { TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { useLeaveRequest } from '../use-leave';
import { AbsenceChart } from './absence-chart';
import { ApprovalSteps } from './approval-steps';
import { CancelLeaveButton } from './cancel-leave-button';
import { InfoResponseForm } from './info-response-form';
import { LeaveConflicts } from './leave-conflicts';
import { LeaveDecisionPanel } from './leave-decision-panel';
import { LeaveHandovers } from './leave-handovers';
import { LeaveSummaryHeader } from './leave-summary-header';
import { useLeaveDecisionMutations } from './use-leave-decision';

const FRAME = 'mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-6 md:px-10 md:py-9';

/**
 * One page for everyone a leave request involves: the approver decides with
 * the live impact in view, the requester follows (and answers questions), and
 * colleagues answer handovers.
 */
export function LeaveDecisionPage({ requestId }: { readonly requestId: string }) {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const detail = useLeaveRequest(requestId, true);
  const staleness = useStaleVersion();
  const mutations = useLeaveDecisionMutations(requestId, staleness.catchStale);
  const refresh = () => void detail.refetch().then(() => staleness.clear());

  if (detail.isPending) return <LeaveDecisionSkeleton />;
  if (detail.isError) {
    return (
      <div className={FRAME}>
        <ErrorState
          {...describeError(detail.error, { resource: 'item', noun: 'leave request' })}
          onRetry={() => detail.refetch()}
          retrying={detail.isFetching}
        />
      </div>
    );
  }
  const request = detail.data;
  const isRequester = request.user.id === user.id;
  return (
    <motion.div {...pageEnter} className={FRAME}>
      <LeaveSummaryHeader request={request} today={today} isRequester={isRequester} />
      <StaleVersionNotice
        show={staleness.stale}
        onRefresh={refresh}
        refreshing={detail.isFetching}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          {isRequester && request.status === 'info_requested' && (
            <InfoResponseForm
              request={request}
              mutation={mutations.respond}
              blocked={staleness.stale}
            />
          )}
          <Section
            title="Who’s away"
            description="Working days on leave are hatched; grey days are not working days."
          >
            <AbsenceChart request={request} today={today} />
          </Section>
          <Section
            title="Work affected"
            description="Worked out now from the tasks and milestones in these days."
          >
            <LeaveConflicts conflicts={request.impact.conflicts} />
            <ImpactNotes impact={request.impact} />
          </Section>
          <Section
            title="Handovers"
            description="Proposed by the person going on leave. Nothing is reassigned until a project manager hands it over."
          >
            <LeaveHandovers
              handovers={request.handovers}
              viewerId={user.id}
              requesterId={request.user.id}
              requesterName={isRequester ? 'You' : (request.user.fullName.split(' ')[0] ?? '')}
              today={today}
              mutation={mutations.handover}
              urgent={request.isUrgentAbsence}
            />
          </Section>
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          {request.viewerCanDecide && (
            <LeaveDecisionPanel
              key={request.version}
              request={request}
              pending={mutations.decide.isPending}
              blocked={staleness.stale}
              onDecide={(input) => mutations.decide.mutate({ ...input, version: request.version })}
            />
          )}
          <Section title="Approval path">
            <div className="rounded-lg border border-hairline bg-raised p-5">
              <ApprovalSteps request={request} />
            </div>
          </Section>
          {request.viewerCanCancel && (
            <CancelLeaveButton
              request={request}
              isRequester={isRequester}
              mutation={mutations.cancel}
              blocked={staleness.stale}
            />
          )}
        </aside>
      </div>
    </motion.div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="type-title-md text-ink">{title}</h2>
        {description && <p className="type-body-sm text-ink-faint">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ImpactNotes({ impact }: { readonly impact: LeaveRequestDetail['impact'] }) {
  const notes = [...impact.blockingProblems, ...impact.warnings];
  if (notes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {notes.map((note) => (
        <li key={note} className="flex items-start gap-2 type-body-sm text-ink-muted">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-at-risk" />
          {note}
        </li>
      ))}
    </ul>
  );
}

function LeaveDecisionSkeleton() {
  return (
    <div className={FRAME}>
      <SkeletonGroup label="Loading the leave request" className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </SkeletonGroup>
    </div>
  );
}
