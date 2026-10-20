'use client';

import type { DeliverableSummary } from '@lintel/api-contracts';
import { Badge, cn, layoutSpring, SkeletonText, StatusPill } from '@lintel/design-system/web';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';
import { formatRelativeInstant } from '@/lib/format/dates';
import { DeliverableReview } from './deliverable-review';
import { DeliverableSubmit } from './deliverable-submit';
import { DeliverableVersions } from './deliverable-versions';
import { DELIVERABLE_STATUS, useDeliverable } from './use-deliverables';

/** One deliverable: status at a glance; versions, submission and review when opened. */
export function DeliverableItem({ deliverable }: { readonly deliverable: DeliverableSummary }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const detail = useDeliverable(deliverable.id, open);
  const status = DELIVERABLE_STATUS[deliverable.status];
  const latest = deliverable.latestVersion;
  return (
    <li className="rounded-lg border border-hairline bg-raised">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-4 text-left hover:bg-sunken/40"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 type-body font-medium text-ink">
            {deliverable.name}
            {deliverable.isRequired && <Badge variant="soft">Required</Badge>}
          </span>
          <span className="type-body-sm text-ink-faint">
            {latest
              ? `Version ${latest.versionNumber} from ${latest.submittedBy.fullName}, ${formatRelativeInstant(latest.submittedAt)}`
              : 'Nothing submitted yet'}
          </span>
        </span>
        <StatusPill tone={status.tone} glyph={status.glyph} label={status.label} size="sm" />
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 text-ink-faint transition-transform duration-(--duration-base)',
            open && 'rotate-180',
          )}
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
              {detail.isPending && <SkeletonText lines={3} />}
              {detail.isError && (
                <p className="type-body-sm text-ink-faint">
                  Versions couldn’t be loaded. Close and open again to retry.
                </p>
              )}
              {detail.data && (
                <>
                  <DeliverableVersions versions={detail.data.versions} />
                  {detail.data.viewerCanReview && detail.data.status === 'in_review' && (
                    <DeliverableReview deliverable={detail.data} />
                  )}
                  {detail.data.viewerCanSubmit &&
                    detail.data.status !== 'approved' &&
                    detail.data.status !== 'cancelled' &&
                    detail.data.status !== 'in_review' && (
                      <DeliverableSubmit deliverable={detail.data} />
                    )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
