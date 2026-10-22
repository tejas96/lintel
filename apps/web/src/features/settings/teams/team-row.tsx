'use client';

import type { Team } from '@lintel/api-contracts';
import { Avatar, Button, cn, StatusPill } from '@lintel/design-system/web';
import { Archive, Pencil, RotateCcw } from 'lucide-react';

export function membersOf(team: Team): string {
  if (team.memberCount === 0) return 'Nobody on it yet';
  return `${team.memberCount} ${team.memberCount === 1 ? 'person' : 'people'}`;
}

interface TeamRowProps {
  readonly team: Team;
  readonly onEdit: () => void;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
  readonly restoring: boolean;
}

/** One team: name, lead, how many people are on it and what can be done. */
export function TeamRow({ team, onEdit, onArchive, onRestore, restoring }: TeamRowProps) {
  const archived = team.archivedAt !== null;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className={cn('type-title-md', archived ? 'text-ink-muted' : 'text-ink')}>
            {team.name}
          </h3>
          {archived && <StatusPill size="sm" tone="neutral" glyph="cancelled" label="Archived" />}
        </div>
        {team.description && (
          <p className="max-w-prose type-body-sm text-ink-muted">{team.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 type-body-sm text-ink-muted">
          {team.lead ? (
            <span className="flex items-center gap-1.5">
              <Avatar name={team.lead.fullName} hue={team.lead.avatarHue} size="xs" decorative />
              <span>
                Led by <span className="text-ink">{team.lead.fullName}</span>
              </span>
            </span>
          ) : (
            <span>No lead</span>
          )}
          <span className="font-mono text-[0.75rem] text-ink-faint">{membersOf(team)}</span>
        </div>
      </div>
      <div className="-ml-3 flex shrink-0 gap-1 sm:ml-0">
        <Button
          size="sm"
          variant="quiet"
          leadingIcon={<Pencil aria-hidden />}
          onClick={onEdit}
          aria-label={`Edit ${team.name}`}
        >
          Edit
        </Button>
        {archived ? (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<RotateCcw aria-hidden />}
            onClick={onRestore}
            pending={restoring}
            aria-label={`Bring back ${team.name}`}
          >
            Bring back
          </Button>
        ) : (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<Archive aria-hidden />}
            onClick={onArchive}
            aria-label={`Archive ${team.name}`}
          >
            Archive
          </Button>
        )}
      </div>
    </div>
  );
}
