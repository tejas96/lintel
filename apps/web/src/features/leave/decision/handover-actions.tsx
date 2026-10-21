'use client';

import type { LeaveHandover } from '@lintel/api-contracts';
import { Button, Field } from '@lintel/design-system/web';
import { UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { PersonCombobox } from '@/features/people/person-combobox';
import type { useLeaveDecisionMutations } from './use-leave-decision';

type HandoverMutation = ReturnType<typeof useLeaveDecisionMutations>['handover'];

interface HandoverActionsProps {
  readonly handover: LeaveHandover;
  readonly isRecipient: boolean;
  /** The viewer manages the task's project and may reassign it. */
  readonly canApply: boolean;
  readonly excludeIds: readonly string[];
  readonly mutation: HandoverMutation;
  /** Chosen from the cover suggestions: opens the choice with this person picked. */
  readonly preferredUserId?: string | null;
}

/**
 * The proposed colleague accepts or declines; a project manager hands the
 * task over (to the proposed person or someone else). Nothing moves on its own.
 */
export function HandoverActions({
  handover,
  isRecipient,
  canApply,
  excludeIds,
  mutation,
  preferredUserId = null,
}: HandoverActionsProps) {
  const preferred = preferredUserId !== null && preferredUserId !== handover.to?.id;
  const [choosing, setChoosing] = useState(preferred);
  const [someoneElse, setSomeoneElse] = useState<string | null>(preferred ? preferredUserId : null);
  const busy = mutation.isPending && mutation.variables?.handoverId === handover.id;
  const answering = isRecipient && handover.status === 'proposed';
  const applicable = canApply && handover.status !== 'applied';
  if (!answering && !applicable) return null;
  const needsChoice = handover.to === null || handover.status === 'declined' || choosing;
  const run = (decision: 'accept' | 'decline' | 'apply', toUserId: string | null = null) =>
    mutation.mutate({ handoverId: handover.id, decision, toUserId });

  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-3">
      {answering && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto type-body-sm text-ink-muted">Can you cover this task?</p>
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => run('decline')}>
            Decline
          </Button>
          <Button
            size="sm"
            variant="primary"
            pending={busy && mutation.variables?.decision === 'accept'}
            onClick={() => run('accept')}
          >
            Accept
          </Button>
        </div>
      )}
      {applicable && !needsChoice && handover.to && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<UserRoundCheck aria-hidden />}
            pending={busy && mutation.variables?.decision === 'apply'}
            onClick={() => run('apply')}
          >
            Hand over to {handover.to.fullName.split(' ')[0]}
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setChoosing(true)}>
            Choose someone else
          </Button>
        </div>
      )}
      {applicable && needsChoice && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Who takes the task over" className="flex-1">
            <PersonCombobox
              value={someoneElse}
              onValueChange={setSomeoneElse}
              excludeIds={excludeIds}
              placeholder="Search colleagues"
            />
          </Field>
          <Button
            size="md"
            variant="secondary"
            disabled={someoneElse === null}
            pending={busy && mutation.variables?.decision === 'apply'}
            onClick={() => run('apply', someoneElse)}
          >
            Hand over
          </Button>
        </div>
      )}
    </div>
  );
}
