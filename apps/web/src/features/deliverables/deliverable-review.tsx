'use client';

import type { DeliverableDetail } from '@lintel/api-contracts';
import { ApprovalCard, Button, Field, Textarea } from '@lintel/design-system/web';
import { Check, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { fileContentUrl } from '@/features/tasks/detail/use-file-upload';
import { formatRelativeInstant } from '@/lib/format/dates';
import { useDeliverableMutations } from './use-deliverables';

type Decision = 'approved' | 'changes_requested' | 'rejected';

/** The reviewer's decision on the latest version. Anything but approval needs a reason. */
export function DeliverableReview({ deliverable }: { readonly deliverable: DeliverableDetail }) {
  const { review } = useDeliverableMutations(deliverable.project.id);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const latest = deliverable.latestVersion;
  if (!latest) return null;

  const decide = (decision: Decision) => {
    const text = comment.trim();
    if (decision !== 'approved' && text.length < 3) {
      setError('Say what needs to change so the designer can act on it.');
      return;
    }
    setError(null);
    review.mutate({
      versionId: latest.id,
      decision,
      comment: text || null,
      version: deliverable.version,
    });
  };
  const pendingFor = (decision: Decision) =>
    review.isPending && review.variables?.decision === decision;

  return (
    <ApprovalCard
      kind="Your decision"
      title={`Version ${latest.versionNumber} of ${deliverable.name}`}
      subtitle={latest.note ?? undefined}
      requestedBy={latest.submittedBy}
      requestedWhen={formatRelativeInstant(latest.submittedAt)}
      preview={
        latest.file.isImage ? (
          // biome-ignore lint/performance/noImgElement: private files come through the API proxy
          <img
            src={fileContentUrl(latest.file.id)}
            alt={latest.file.originalName}
            className="aspect-[16/9] w-full object-cover"
          />
        ) : undefined
      }
      actions={
        <>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Check aria-hidden />}
            pending={pendingFor('approved')}
            onClick={() => decide('approved')}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<RotateCcw aria-hidden />}
            pending={pendingFor('changes_requested')}
            onClick={() => decide('changes_requested')}
          >
            Request changes
          </Button>
          <Button
            variant="danger"
            size="sm"
            leadingIcon={<X aria-hidden />}
            pending={pendingFor('rejected')}
            onClick={() => decide('rejected')}
          >
            Reject
          </Button>
        </>
      }
    >
      <Field
        label="Comment for the designer"
        hint="Needed when you request changes or reject."
        error={error}
      >
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Field>
    </ApprovalCard>
  );
}
