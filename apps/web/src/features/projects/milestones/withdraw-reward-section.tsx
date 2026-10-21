'use client';

import type { Milestone, MilestoneRewardPlan, ProjectDetail } from '@lintel/api-contracts';
import { Button, Field, Textarea } from '@lintel/design-system/web';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { useWithdrawMilestoneReward } from './use-milestone-actions';

/**
 * Withdrawing a planned reward, inside the editor: a second step that asks
 * for the reason the people it was for will read. Not a nested form.
 */
export function WithdrawRewardSection(props: {
  readonly project: ProjectDetail;
  readonly milestone: Milestone;
  readonly plan: MilestoneRewardPlan;
  readonly onDone: () => void;
}) {
  const withdraw = useWithdrawMilestoneReward(props.project.id);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();

  const confirm = () => {
    if (reason.trim().length < 3) {
      setError('Say why, in a few words. They will read it.');
      return;
    }
    withdraw.mutate(
      { milestone: props.milestone, plan: props.plan, reason: reason.trim() },
      {
        onSuccess: props.onDone,
        onError: (failure) => setError(isApiError(failure) ? failure.message : 'Try again.'),
      },
    );
  };

  return (
    <section
      aria-label="Withdraw the reward"
      className="flex flex-col gap-3 border-t border-hairline pt-5"
    >
      {!asking ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="self-start"
          onClick={() => setAsking(true)}
        >
          Withdraw this reward
        </Button>
      ) : null}
      <AnimatePresence initial={false}>
        {asking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="-mx-1 flex flex-col gap-3 overflow-hidden px-1 pb-1"
          >
            <Field label="Why it is withdrawn" error={error} required>
              <Textarea
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError(undefined);
                }}
                rows={2}
                maxLength={2000}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                pending={withdraw.isPending}
                onClick={confirm}
              >
                Withdraw reward
              </Button>
              <Button type="button" variant="quiet" size="sm" onClick={() => setAsking(false)}>
                Keep it
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
