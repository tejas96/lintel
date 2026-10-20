'use client';

import {
  Badge,
  ErrorState,
  pageEnter,
  Skeleton,
  SkeletonGroup,
  StatusPill,
} from '@lintel/design-system/web';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ProjectChip } from '@/features/tasks/task-presentation';
import { describeError } from '@/lib/api/describe-error';
import { DeliverableReview } from './deliverable-review';
import { DeliverableSubmit } from './deliverable-submit';
import { DeliverableVersions } from './deliverable-versions';
import { DELIVERABLE_STATUS, useDeliverable } from './use-deliverables';

const FRAME = 'mx-auto flex w-full max-w-5xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9';

/**
 * One deliverable on its own page (where the approvals inbox sends a
 * reviewer): every version, the review, and the next submission.
 */
export function DeliverablePage({ deliverableId }: { readonly deliverableId: string }) {
  const detail = useDeliverable(deliverableId, true);
  if (detail.isPending) {
    return (
      <div className={FRAME}>
        <SkeletonGroup label="Loading the deliverable" className="flex flex-col gap-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-72 rounded-lg" />
        </SkeletonGroup>
      </div>
    );
  }
  if (detail.isError) {
    return (
      <div className={FRAME}>
        <ErrorState
          {...describeError(detail.error, { resource: 'item', noun: 'deliverable' })}
          onRetry={() => detail.refetch()}
        />
      </div>
    );
  }
  const deliverable = detail.data;
  const status = DELIVERABLE_STATUS[deliverable.status];
  const back = deliverable.task
    ? { href: `/tasks/${deliverable.task.id}`, label: deliverable.task.title }
    : { href: `/projects/${deliverable.project.id}/deliverables`, label: deliverable.project.name };
  const canSubmit =
    deliverable.viewerCanSubmit &&
    !['approved', 'cancelled', 'in_review'].includes(deliverable.status);
  return (
    <motion.div {...pageEnter} className={FRAME}>
      <header className="flex flex-col gap-4">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 self-start rounded-sm type-body-sm text-ink-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
        <ProjectChip project={deliverable.project} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="flex flex-wrap items-center gap-3 type-display-md text-ink md:type-display-lg">
            {deliverable.name}
            {deliverable.isRequired && <Badge variant="soft">Required</Badge>}
          </h1>
          <StatusPill
            tone={status.tone}
            glyph={status.glyph}
            label={status.label}
            className="self-start"
          />
        </div>
        {deliverable.description && (
          <p className="max-w-prose type-body text-ink-muted">{deliverable.description}</p>
        )}
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="flex flex-col gap-3">
          <h2 className="type-title-md text-ink">Versions</h2>
          <div className="rounded-lg border border-hairline bg-raised p-5">
            <DeliverableVersions versions={deliverable.versions} />
          </div>
        </section>
        <aside className="flex flex-col gap-4">
          {deliverable.viewerCanReview && deliverable.status === 'in_review' && (
            <DeliverableReview deliverable={deliverable} />
          )}
          {canSubmit && <DeliverableSubmit deliverable={deliverable} />}
          {!deliverable.viewerCanReview && !canSubmit && (
            <p className="rounded-lg border border-hairline bg-raised p-4 type-body-sm text-ink-muted">
              {deliverable.reviewer
                ? `${deliverable.reviewer.fullName} reviews this deliverable.`
                : 'A reviewer has not been chosen yet.'}
            </p>
          )}
        </aside>
      </div>
    </motion.div>
  );
}
