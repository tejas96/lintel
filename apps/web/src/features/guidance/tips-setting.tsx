'use client';

import { Button, useToast } from '@lintel/design-system/web';
import { Compass } from 'lucide-react';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { useGuidance, useResetTips } from './use-guidance';

/** Account: how many first-run tips are left, and a way to see them all again. */
export function TipsSetting() {
  const guidance = useGuidance();
  const reset = useResetTips();
  const toast = useToast();
  const fail = useFailureToast();
  const tips = guidance.data?.tips ?? [];
  const seen = tips.filter((tip) => tip.seen).length;
  return (
    <div className="flex max-w-md flex-col gap-4 rounded-lg border border-hairline bg-raised p-5 sm:flex-row sm:items-center">
      <Compass aria-hidden className="hidden size-5 shrink-0 text-ink-faint sm:block" />
      <p className="flex-1 type-body-sm text-ink-muted">
        {tips.length === 0
          ? 'Tips appear the first time you open a screen.'
          : seen === 0
            ? `${tips.length} tips are waiting for the screens you have not opened yet.`
            : `You have seen ${seen} of ${tips.length} tips.`}
      </p>
      <Button
        size="sm"
        disabled={seen === 0}
        pending={reset.isPending}
        onClick={() =>
          reset.mutate(undefined, {
            onSuccess: () =>
              toast({
                tone: 'success',
                title: 'Tips will show again',
                description: 'Each one appears the next time you open its screen.',
              }),
            onError: (error) => fail(error, 'show the tips again'),
          })
        }
      >
        Show tips again
      </Button>
    </div>
  );
}
