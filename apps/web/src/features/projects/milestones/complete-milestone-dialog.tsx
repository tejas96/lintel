'use client';

import type { Milestone, MilestoneRewardPlan } from '@lintel/api-contracts';
import { Button, Dialog, Field, Textarea } from '@lintel/design-system/web';
import { useState } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { useCompleteMilestone } from './use-milestone-actions';

/**
 * Confirms completing a milestone. When it carries a reward, the dialog says
 * that completing checks the reward and sends it to a reviewer.
 */
export function CompleteMilestoneDialog(props: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly projectId: string;
  readonly milestone: Milestone;
  readonly plan: MilestoneRewardPlan | null;
}) {
  const complete = useCompleteMilestone(props.projectId);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const rewarded = props.plan?.state === 'planned';
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Complete “${props.milestone.name}”?`}
      description={
        rewarded
          ? 'Its reward is checked now against its conditions and goes to a reviewer. Nothing is granted until they decide.'
          : 'Every task of this milestone is closed. Completing it is recorded in the project history.'
      }
      footer={
        <>
          <Button variant="quiet" onClick={() => props.onOpenChange(false)}>
            Not yet
          </Button>
          <Button
            variant="primary"
            pending={complete.isPending}
            onClick={() =>
              complete.mutate(
                { milestone: props.milestone, note: note.trim() || null },
                {
                  onSuccess: () => props.onOpenChange(false),
                  onError: (failure) =>
                    setError(describeError(failure, { resource: 'item' }).message),
                },
              )
            }
          >
            Complete milestone
          </Button>
        </>
      }
    >
      <Field label="Note (optional)" hint="Shown in the project activity." error={error}>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Field>
    </Dialog>
  );
}
