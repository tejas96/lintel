'use client';

import type { ProjectCostEntry } from '@lintel/api-contracts';
import { Button, cn, Dialog, Field, IconButton, Textarea } from '@lintel/design-system/web';
import { PROJECT_COST_CATEGORY_LABELS } from '@lintel/domain';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { formatCalendarDate } from '@/lib/format/dates';
import { formatMoney } from './finance-presentation';
import { useVoidCost } from './use-project-finances';

const SHOWN = 6;

/** The newest ledger entries; voided ones stay visible, struck through, with the reason. */
export function CostLedger({
  projectId,
  entries,
  entryCount,
  today,
}: {
  readonly projectId: string;
  readonly entries: readonly ProjectCostEntry[];
  readonly entryCount: number;
  readonly today: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [voiding, setVoiding] = useState<ProjectCostEntry | null>(null);
  const shown = expanded ? entries : entries.slice(0, SHOWN);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="type-label text-ink-muted">Cost ledger</h3>
      <ul className="flex flex-col divide-y divide-hairline">
        {shown.map((entry) => {
          const voided = entry.voidedAt !== null;
          return (
            <li
              key={entry.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_2.25rem] items-start gap-x-3 gap-y-1 py-2.5 @lg:grid-cols-[3.5rem_minmax(0,1fr)_auto_2.25rem]"
            >
              <span className="col-start-1 row-start-1 pt-0.5 font-mono text-[0.75rem] text-ink-faint tabular-nums">
                {formatCalendarDate(entry.entryDate, today)}
              </span>
              <div className="col-span-3 col-start-1 row-start-2 flex min-w-0 flex-col gap-0.5 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1">
                <p
                  className={
                    voided ? 'type-body-sm text-ink-faint line-through' : 'type-body-sm text-ink'
                  }
                >
                  {PROJECT_COST_CATEGORY_LABELS[entry.category]}
                  {entry.note ? <span className="text-ink-muted"> · {entry.note}</span> : null}
                </p>
                <p className="type-body-sm text-ink-faint">
                  {voided
                    ? `Voided by ${entry.voidedBy?.fullName ?? 'someone'}: ${entry.voidReason ?? ''}`
                    : `Recorded by ${entry.recordedBy.fullName}`}
                </p>
              </div>
              <span
                className={cn(
                  'col-start-2 row-start-1 pt-0.5 text-right font-mono text-[0.8125rem] tabular-nums @lg:col-start-3',
                  voided ? 'text-ink-faint line-through' : 'text-ink',
                )}
              >
                {formatMoney(entry.amountMinor, entry.currency)}
              </span>
              {!voided && (
                <IconButton
                  label={`Void the ${PROJECT_COST_CATEGORY_LABELS[entry.category].toLowerCase()} entry of ${formatMoney(entry.amountMinor, entry.currency)}`}
                  size="sm"
                  className="col-start-3 row-start-1 -my-1.5 justify-self-end @lg:col-start-4"
                  onClick={() => setVoiding(entry)}
                >
                  <Ban aria-hidden />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
      {entries.length > SHOWN && (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show fewer' : `Show all ${entries.length}`}
        </Button>
      )}
      {entryCount > entries.length && (
        <p className="type-body-sm text-ink-faint">
          The newest {entries.length} of {entryCount} entries are shown.
        </p>
      )}
      <VoidCostDialog projectId={projectId} entry={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

function VoidCostDialog({
  projectId,
  entry,
  onClose,
}: {
  readonly projectId: string;
  readonly entry: ProjectCostEntry | null;
  readonly onClose: () => void;
}) {
  const voidCost = useVoidCost(projectId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };
  const confirm = () => {
    if (!entry) return;
    if (reason.trim().length < 3) {
      setError('Say why, for example “Entered twice”.');
      return;
    }
    voidCost.mutate({ entry, reason: reason.trim() }, { onSuccess: close });
  };
  return (
    <Dialog
      autoFocusField
      open={entry !== null}
      onOpenChange={(open) => !open && close()}
      size="sm"
      title="Void this cost?"
      description={
        entry
          ? `${formatMoney(entry.amountMinor, entry.currency)} for ${PROJECT_COST_CATEGORY_LABELS[entry.category].toLowerCase()} stops counting against the budget. It stays on the ledger with your reason.`
          : undefined
      }
      footer={
        <>
          <Button variant="quiet" onClick={close}>
            Keep it
          </Button>
          <Button variant="danger" pending={voidCost.isPending} onClick={confirm}>
            Void entry
          </Button>
        </>
      }
    >
      <Field label="Reason" error={error} required>
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
