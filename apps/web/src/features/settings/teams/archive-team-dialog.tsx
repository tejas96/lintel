'use client';

import type { Team } from '@lintel/api-contracts';
import { Button, Dialog } from '@lintel/design-system/web';
import { teamArchiveBlocker } from '@lintel/domain';

interface ArchiveTeamDialogProps {
  readonly team: Team | null;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (team: Team) => void;
}

/**
 * Archiving waits until nobody active is on the team, so nobody ends up on a
 * team that cannot be chosen. The dialog says which case applies.
 */
export function ArchiveTeamDialog({ team, pending, onCancel, onConfirm }: ArchiveTeamDialogProps) {
  const blocker = team ? teamArchiveBlocker(team.memberCount) : null;
  return (
    <Dialog
      open={team !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      size="sm"
      title={team ? `Archive ${team.name}?` : 'Archive team?'}
      description={
        blocker
          ? 'A team can be archived once nobody active is on it.'
          : 'It can no longer be chosen for anyone. You can bring it back later.'
      }
      footer={
        blocker ? (
          <Button variant="primary" onClick={onCancel}>
            Got it
          </Button>
        ) : (
          <>
            <Button variant="quiet" onClick={onCancel} disabled={pending}>
              Keep the team
            </Button>
            <Button variant="danger" pending={pending} onClick={() => team && onConfirm(team)}>
              Archive
            </Button>
          </>
        )
      }
    >
      <p className="type-body-sm text-ink-muted">
        {blocker
          ? `${blocker} Open People, filter by this team and change each person’s team.`
          : 'People who have left the studio keep it on their record, and past reports are unchanged.'}
      </p>
    </Dialog>
  );
}
