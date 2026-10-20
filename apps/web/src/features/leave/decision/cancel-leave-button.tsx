'use client';

import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { Button, Dialog, Field, Textarea } from '@lintel/design-system/web';
import { useState } from 'react';
import type { useLeaveDecisionMutations } from './use-leave-decision';

type CancelMutation = ReturnType<typeof useLeaveDecisionMutations>['cancel'];

interface CancelLeaveButtonProps {
  readonly request: LeaveRequestDetail;
  readonly isRequester: boolean;
  readonly mutation: CancelMutation;
  readonly blocked: boolean;
}

/** Cancelling asks once; days return to the balance and approvers are told. */
export function CancelLeaveButton({
  request,
  isRequester,
  mutation,
  blocked,
}: CancelLeaveButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const confirm = () =>
    mutation.mutate(
      { note: note.trim() || null, version: request.version },
      { onSettled: () => setOpen(false) },
    );
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        className="self-start"
        disabled={blocked}
        onClick={() => setOpen(true)}
      >
        {isRequester ? 'Cancel this leave' : 'Cancel this leave for them'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Cancel this leave?"
        description={
          isRequester
            ? 'The days go back to your balance and your approvers are told.'
            : `The days go back to ${request.user.fullName}’s balance and they are told.`
        }
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" pending={mutation.isPending} onClick={confirm}>
              Cancel leave
            </Button>
          </>
        }
      >
        <Field label="Note" hint="Optional. Shown on the request.">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
      </Dialog>
    </>
  );
}
