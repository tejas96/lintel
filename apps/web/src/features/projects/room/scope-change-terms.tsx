'use client';

import type { ScopeChangeDetail } from '@lintel/api-contracts';
import { Button, StatusPill } from '@lintel/design-system/web';
import { CLIENT_SIGN_OFF_METHOD_LABELS, PROJECT_COST_CATEGORY_LABELS } from '@lintel/domain';
import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '@/features/finances/finance-presentation';
import { formatCalendarDate } from '@/lib/format/dates';
import { ClientSignOffDialog } from './client-sign-off-dialog';

interface ScopeChangeTermsProps {
  readonly change: ScopeChangeDetail;
  readonly today: string;
  readonly currency: string;
  readonly clientName: string;
  /** The project manager or an approver: may record the client's sign-off. */
  readonly canRecordSignOff: boolean;
}

function MoneyTerms({ change, currency }: Pick<ScopeChangeTermsProps, 'change' | 'currency'>) {
  const money = change.money;
  if (!money || (money.costImpactMinor === null && money.feeImpactMinor === null)) return null;
  const fee = money.feeImpactMinor;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-md bg-sunken/60 px-3 py-2.5 type-body-sm">
      <span className="inline-flex items-center gap-1.5 text-ink-faint">
        <LockKeyhole aria-hidden className="size-3.5" />
        <span className="sr-only">Seen only by people who can see the budget:</span>
        Budget
      </span>
      {money.costImpactMinor !== null && (
        <span className="text-ink-muted">
          Cost to the studio{' '}
          <span className="font-mono text-ink tabular-nums">
            {formatMoney(money.costImpactMinor, currency)}
          </span>
          {money.costCategory && ` · ${PROJECT_COST_CATEGORY_LABELS[money.costCategory]}`}
        </span>
      )}
      {fee !== null && (
        <span className="text-ink-muted">
          Client pays{' '}
          <span className="font-mono text-ink tabular-nums">
            {formatMoney(Math.abs(fee), currency)}
          </span>{' '}
          {fee > 0 ? 'more' : 'less'}
        </span>
      )}
    </div>
  );
}

/** The money a change carries (for budget viewers) and the client's sign-off with its history. */
export function ScopeChangeTerms(props: ScopeChangeTermsProps) {
  const { change, today, clientName, canRecordSignOff } = props;
  const [recording, setRecording] = useState(false);
  const [latest, ...earlier] = change.clientSignOffs;
  const open = change.status === 'proposed';
  const needsSignOff = change.requiresClientSignOff || change.clientSignOffs.length > 0;
  return (
    <div className="flex flex-col gap-3">
      <MoneyTerms change={change} currency={props.currency} />
      {needsSignOff && (
        <div className="flex flex-col gap-2 rounded-md border border-hairline px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {latest ? (
              <StatusPill tone="onTrack" glyph="done" label="Client signed off" size="sm" />
            ) : (
              <StatusPill tone="atRisk" glyph="atRisk" label="Waiting for the client" size="sm" />
            )}
            {open && canRecordSignOff && (
              <Button
                size="sm"
                variant={latest ? 'quiet' : 'secondary'}
                onClick={() => setRecording(true)}
              >
                {latest ? 'Record again' : 'Record sign-off'}
              </Button>
            )}
          </div>
          {latest ? (
            <p className="type-body-sm text-ink">
              {latest.confirmedByName} confirmed{' '}
              {CLIENT_SIGN_OFF_METHOD_LABELS[latest.method].toLowerCase()} on{' '}
              {formatCalendarDate(latest.confirmedOn, today)}
              {latest.note && <span className="text-ink-muted"> · “{latest.note}”</span>}
              {latest.recordedBy && (
                <span className="text-ink-faint"> · recorded by {latest.recordedBy.fullName}</span>
              )}
            </p>
          ) : (
            <p className="type-body-sm text-ink-muted">
              Approval waits until someone records who at {clientName} confirmed it, when and how.
            </p>
          )}
          {earlier.length > 0 && (
            <details className="type-body-sm text-ink-muted">
              <summary className="cursor-pointer rounded-sm text-ink-faint">
                {earlier.length} earlier {earlier.length === 1 ? 'record' : 'records'}
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1 pl-4">
                {earlier.map((entry) => (
                  <li key={entry.id}>
                    {entry.confirmedByName},{' '}
                    {CLIENT_SIGN_OFF_METHOD_LABELS[entry.method].toLowerCase()},{' '}
                    {formatCalendarDate(entry.confirmedOn, today)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {canRecordSignOff && open && (
        <ClientSignOffDialog
          change={change}
          clientName={clientName}
          today={today}
          open={recording}
          onOpenChange={setRecording}
        />
      )}
    </div>
  );
}
