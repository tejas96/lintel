'use client';

import type { ChallengeEntry } from '@lintel/api-contracts';
import { Button } from '@lintel/design-system/web';
import { MessageSquareWarning } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { ChallengeHistory } from './challenge-history';
import { ChallengeSheet } from './challenge-sheet';

interface RecordChallengesProps {
  readonly recordKind: 'evaluation' | 'milestone';
  readonly recordId: string;
  readonly title: string;
  readonly currency: string;
  readonly challenges: readonly ChallengeEntry[];
  readonly challengeable: { readonly allowed: boolean; readonly reason: string | null };
  /** Only the person's own view offers the button; reviewers see the history only. */
  readonly offerChallenge: boolean;
}

/**
 * The foot of a reward record: its challenge history and, for the person it
 * is about, a way to challenge it. When the server says no, the reason is
 * shown only if it helps (a challenge already waiting, or the limit reached).
 */
export function RecordChallenges(props: RecordChallengesProps) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const { challengeable } = props;
  const waiting = props.challenges.some((challenge) => challenge.status === 'open');
  const showReason = props.offerChallenge && !challengeable.allowed && props.challenges.length > 0;
  if (props.challenges.length === 0 && !(props.offerChallenge && challengeable.allowed))
    return null;
  return (
    <div className="flex flex-col gap-4 border-t border-hairline pt-4">
      <ChallengeHistory
        challenges={props.challenges}
        currency={props.currency}
        viewerId={user.id}
      />
      {props.offerChallenge && challengeable.allowed && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-prose type-body-sm text-ink-muted">
            Something not right? Challenge it with a reason; a reviewer answers with a note.
          </p>
          <Button
            size="sm"
            leadingIcon={<MessageSquareWarning aria-hidden />}
            onClick={() => setOpen(true)}
            className="self-start sm:self-auto"
          >
            Challenge
          </Button>
        </div>
      )}
      {showReason && !waiting && challengeable.reason && (
        <p className="type-body-sm text-ink-faint">{challengeable.reason}</p>
      )}
      <ChallengeSheet
        open={open}
        onOpenChange={setOpen}
        record={{ recordKind: props.recordKind, recordId: props.recordId, title: props.title }}
      />
    </div>
  );
}
