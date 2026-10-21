'use client';

import { Button, Field, Sheet, Textarea } from '@lintel/design-system/web';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { describeError } from '@/lib/api/describe-error';
import { type RaiseChallengeInput, useRaiseChallenge } from './use-reward-records';

interface ChallengeSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly record: Omit<RaiseChallengeInput, 'reason'> & { readonly title: string };
}

const MINIMUM = 10;

/**
 * Challenge one record with a reason. It goes to the reviewer who decided
 * it, who upholds or corrects it with a note; the person is told either way.
 */
export function ChallengeSheet({ open, onOpenChange, record }: ChallengeSheetProps) {
  const raise = useRaiseChallenge();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < MINIMUM) {
      setError('Explain what is wrong, in a sentence or two.');
      return;
    }
    raise.mutate(
      { recordKind: record.recordKind, recordId: record.recordId, reason: text },
      {
        onSuccess: () => {
          setReason('');
          onOpenChange(false);
        },
        onError: (failure) => {
          const fields = isApiError(failure) ? failure.fieldErrors() : {};
          setError(fields.reason ?? describeError(failure, { resource: 'item' }).message);
        },
      },
    );
  };

  return (
    <Sheet
      autoFocusField
      open={open}
      onOpenChange={onOpenChange}
      title="Challenge this record"
      description={record.title}
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="reward-challenge" variant="primary" pending={raise.isPending}>
            Send challenge
          </Button>
        </>
      }
    >
      <form id="reward-challenge" onSubmit={submit} className="flex flex-col gap-5 p-5 sm:p-6">
        <p className="type-body text-ink-muted">
          Say what the record got wrong and where the reviewer can check it — a date, a task, a
          blocker you raised. The reviewer answers with a note, and can correct the record. A
          challenge never lowers a reward.
        </p>
        <Field
          label="What is wrong"
          hint="At least a sentence. Your reviewer sees exactly what you write."
          error={error}
          required
        >
          <Textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
            rows={5}
            maxLength={2000}
          />
        </Field>
      </form>
    </Sheet>
  );
}
