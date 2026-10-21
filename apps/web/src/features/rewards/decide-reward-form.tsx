'use client';

import {
  Button,
  Checkbox,
  Field,
  Input,
  SegmentedControl,
  Textarea,
} from '@lintel/design-system/web';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';

const CHOICES = [
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Don’t approve' },
] as const;

/** "3000" or "2,500.50" in rupees → minor units, or null when it isn't an amount. */
function toMinorUnits(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export interface RewardDecision {
  readonly decision: 'approve' | 'reject';
  readonly note: string;
  readonly adjustedAmountMinor: number | null;
}

interface DecideRewardFormProps {
  /** The proposed amount, when the reviewer may see it. */
  readonly amountMinor: number | null;
  readonly busy: boolean;
  readonly blocked: boolean;
  /** Sends the decision; server field errors come back through `onFailure`. */
  readonly onDecide: (decision: RewardDecision, onFailure: (error: unknown) => void) => void;
}

/** Approve (optionally with a different amount) or decline, always with a note. */
export function DecideRewardForm({ amountMinor, busy, blocked, onDecide }: DecideRewardFormProps) {
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [amount, setAmount] = useState(amountMinor === null ? '' : String(amountMinor / 100));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (note.trim().length < 3) found.note = 'Add a short note explaining the decision.';
    const adjusted = decision === 'approve' && adjusting ? toMinorUnits(amount) : null;
    if (decision === 'approve' && adjusting && adjusted === null) {
      found.adjustedAmountMinor = 'Enter an amount in rupees, like 2500.';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onDecide({ decision, note: note.trim(), adjustedAmountMinor: adjusted }, (error) => {
      if (isApiError(error)) setErrors(error.fieldErrors());
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border-t border-hairline pt-5">
      <SegmentedControl
        label="Decision"
        value={decision}
        onValueChange={setDecision}
        options={CHOICES}
        size="sm"
        className="self-start"
      />
      <Field
        label="Note"
        hint={
          decision === 'approve'
            ? 'They see it with the reward. If you change the amount, say why.'
            : 'They see it, so be specific about what would have counted.'
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
      {decision === 'approve' && amountMinor !== null && (
        <div className="flex flex-col gap-2">
          <Checkbox
            checked={adjusting}
            onCheckedChange={setAdjusting}
            label="Use a different amount"
            description="The policy amount stays on record next to yours."
          />
          <AnimatePresence initial={false}>
            {adjusting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="-mx-1 overflow-hidden px-1 pb-1"
              >
                <Field label="Amount (₹)" error={errors.adjustedAmountMinor} className="max-w-xs">
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
        </div>
      )}
      <Button
        type="submit"
        variant={decision === 'approve' ? 'primary' : 'danger'}
        pending={busy}
        disabled={blocked}
        className="self-start"
      >
        {decision === 'approve' ? 'Approve reward' : 'Don’t approve'}
      </Button>
    </form>
  );
}
