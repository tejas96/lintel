'use client';

import type { RewardChallenge } from '@lintel/api-contracts';
import { Button, Field, Input, SegmentedControl, Textarea } from '@lintel/design-system/web';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { formatAmount } from './reward-presentation';
import type { useResolveChallenge } from './use-reward-records';

const CHOICES = [
  { value: 'uphold', label: 'Uphold the record' },
  { value: 'correct', label: 'Correct it' },
] as const;

/** "3000" or "2,500.50" in rupees → minor units, or null when it isn't an amount. */
function toMinorUnits(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

interface ResolveChallengeFormProps {
  readonly challenge: RewardChallenge;
  readonly mutation: ReturnType<typeof useResolveChallenge>;
  readonly blocked: boolean;
}

/**
 * The reviewer's answer: uphold the record, or correct it by granting the
 * reward or raising what was granted. Always with a note the person reads.
 */
export function ResolveChallengeForm({ challenge, mutation, blocked }: ResolveChallengeFormProps) {
  const granted = challenge.before.grantedAmountMinor;
  const proposed = challenge.record.proposedAmountMinor;
  const [outcome, setOutcome] = useState<'uphold' | 'correct'>('uphold');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(
    proposed === null ? '' : String(Math.max(proposed, granted ?? 0) / 100),
  );
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const busy = mutation.isPending && mutation.variables?.challenge.id === challenge.id;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (note.trim().length < 3) found.note = 'Add a note: the person reads it.';
    const corrected = outcome === 'correct' ? toMinorUnits(amount) : null;
    if (outcome === 'correct' && corrected === null) {
      found.correctedAmountMinor = 'Enter an amount in rupees, like 2500.';
    } else if (
      outcome === 'correct' &&
      granted !== null &&
      corrected !== null &&
      corrected <= granted
    ) {
      found.correctedAmountMinor = `A correction can only raise the ${formatAmount(granted, challenge.record.currency)} already granted.`;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    mutation.mutate(
      { challenge, outcome, note: note.trim(), correctedAmountMinor: corrected },
      { onError: (error) => isApiError(error) && setErrors(error.fieldErrors()) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border-t border-hairline pt-5">
      <SegmentedControl
        label="Answer"
        value={outcome}
        onValueChange={setOutcome}
        options={CHOICES}
        size="sm"
        className="self-start"
      />
      <Field
        label="Note"
        hint={
          outcome === 'uphold'
            ? 'Explain why the record stands, so they can see what would have counted.'
            : 'Explain what was wrong. They see it on the record.'
        }
        error={errors.note}
        required
      >
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Field>
      <AnimatePresence initial={false}>
        {outcome === 'correct' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="-mx-1 overflow-hidden px-1 pb-1"
          >
            <Field
              label="Amount they receive (₹)"
              hint="A correction grants the reward or raises it. It never lowers one."
              error={errors.correctedAmountMinor}
              className="max-w-sm"
            >
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                leading={<span className="text-[0.9375rem]">₹</span>}
              />
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
      <Button
        type="submit"
        variant="primary"
        pending={busy}
        disabled={blocked}
        className="self-start"
      >
        {outcome === 'uphold' ? 'Uphold and reply' : 'Correct the record'}
      </Button>
    </form>
  );
}
