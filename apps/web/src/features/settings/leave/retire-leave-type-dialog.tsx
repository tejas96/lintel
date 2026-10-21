'use client';

import type { ManagedLeaveType } from '@lintel/api-contracts';
import { Button, Dialog } from '@lintel/design-system/web';

interface RetireLeaveTypeDialogProps {
  readonly type: ManagedLeaveType | null;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (type: ManagedLeaveType) => void;
}

function consequenceOf(type: ManagedLeaveType): string {
  if (type.requestCount === 0) return 'Nobody has used it yet.';
  const requests = `The ${type.requestCount} ${type.requestCount === 1 ? 'request' : 'requests'} already made with it stay as they are`;
  return type.openRequestCount > 0
    ? `${requests}, and the ${type.openRequestCount} still waiting can be decided as usual.`
    : `${requests}.`;
}

/** Retiring is reversible and never touches existing requests; the dialog says exactly that. */
export function RetireLeaveTypeDialog({
  type,
  pending,
  onCancel,
  onConfirm,
}: RetireLeaveTypeDialogProps) {
  return (
    <Dialog
      open={type !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      size="sm"
      title={type ? `Retire ${type.name}?` : 'Retire leave type?'}
      description="People can no longer choose it for new requests. You can offer it again later."
      footer={
        <>
          <Button variant="quiet" onClick={onCancel} disabled={pending}>
            Keep offering it
          </Button>
          <Button variant="danger" pending={pending} onClick={() => type && onConfirm(type)}>
            Retire
          </Button>
        </>
      }
    >
      {type && <p className="type-body-sm text-ink-muted">{consequenceOf(type)}</p>}
    </Dialog>
  );
}
