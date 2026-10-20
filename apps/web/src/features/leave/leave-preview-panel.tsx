import { SkeletonText } from '@lintel/design-system/web';
import { LeaveImpactSummary } from './leave-impact';
import type { LeavePeriodInput, useLeavePreview } from './use-leave';

interface LeavePreviewPanelProps {
  readonly period: LeavePeriodInput | null;
  readonly preview: ReturnType<typeof useLeavePreview>;
  readonly today: string;
  /** "you" for your own leave, a first name when recording someone's absence. */
  readonly subject?: string;
}

/** The server's live answer to "what does this leave touch?", as the dates change. */
export function LeavePreviewPanel({ period, preview, today, subject }: LeavePreviewPanelProps) {
  return (
    <section aria-live="polite" className="rounded-lg border border-hairline bg-surface p-4">
      {!period && (
        <p className="type-body-sm text-ink-faint">
          Choose the days to see how long it is and what it affects.
        </p>
      )}
      {period && preview.isPending && <SkeletonText lines={3} />}
      {period && preview.data && (
        <div
          className={preview.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}
        >
          <LeaveImpactSummary
            impact={preview.data}
            today={today}
            {...(subject ? { subject } : {})}
          />
        </div>
      )}
      {period && preview.isError && (
        <p className="type-body-sm text-overdue">
          The preview couldn’t be worked out. Check the dates and try again.
        </p>
      )}
    </section>
  );
}
