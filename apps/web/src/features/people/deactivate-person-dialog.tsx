'use client';

import { Button, Dialog, Field, Textarea } from '@lintel/design-system/web';
import { useState } from 'react';

interface DeactivatePersonDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly name: string;
  readonly pending: boolean;
  readonly onConfirm: (reason: string) => void;
}

/** Asks for the reason (it goes into the audit trail) and confirms what will happen. */
export function DeactivatePersonDialog({
  open,
  onOpenChange,
  name,
  pending,
  onConfirm,
}: DeactivatePersonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const confirm = () => {
    if (reason.trim().length < 3) {
      setError('Say briefly why, for the record.');
      return;
    }
    setError(null);
    onConfirm(reason.trim());
  };
  return (
    <Dialog
      autoFocusField
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={`Deactivate ${name}?`}
      description="They are signed out on every device and can’t sign in. Their tasks stay where they are, so reassign open work from each project."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Keep active
          </Button>
          <Button variant="danger" pending={pending} onClick={confirm}>
            Deactivate
          </Button>
        </>
      }
    >
      <Field label="Reason" hint="Kept in the audit log." error={error} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Field>
    </Dialog>
  );
}
