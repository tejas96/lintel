'use client';

import type { Team } from '@lintel/api-contracts';
import {
  Button,
  EmptyState,
  ErrorState,
  listItemEnter,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from '@lintel/design-system/web';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { ArchiveTeamDialog } from './archive-team-dialog';
import { TeamRow } from './team-row';
import { TeamSheet, type TeamSheetMode } from './team-sheet';
import { allTeamsKey, useAllTeams, useTeamMutations } from './use-teams';

function SectionHeading({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="type-title-lg text-ink">{title}</h2>
      <p className="type-body-sm text-ink-muted">{detail}</p>
    </div>
  );
}

/** Studio teams, for holders of `users.manage`: add, rename, set a lead, archive. */
export function TeamsView() {
  const toast = useToast();
  const fail = useFailureToast();
  const teams = useAllTeams();
  const { setActive } = useTeamMutations();
  const [sheet, setSheet] = useState<TeamSheetMode | null>(null);
  const [archiving, setArchiving] = useState<Team | null>(null);

  if (teams.isPending)
    return (
      <SkeletonGroup label="Loading teams">
        <SkeletonText lines={6} />
      </SkeletonGroup>
    );
  if (teams.isError)
    return (
      <ErrorState
        {...describeError(teams.error, { resource: 'collection' })}
        onRetry={() => teams.refetch()}
      />
    );

  const active = teams.data.filter((team) => team.archivedAt === null);
  const archived = teams.data.filter((team) => team.archivedAt !== null);
  const change = (team: Team, restore: boolean) =>
    setActive.mutate(
      { team, active: restore },
      {
        onSuccess: (saved) => {
          setArchiving(null);
          toast({
            tone: 'success',
            title: restore ? 'Team brought back' : 'Team archived',
            description: saved.name,
          });
        },
        onError: (error) => {
          setArchiving(null);
          fail(error, restore ? 'bring the team back' : 'archive the team', [allTeamsKey]);
        },
      },
    );
  const list = (items: readonly Team[]) => (
    <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-raised">
      {items.map((team, index) => (
        <motion.li key={team.id} {...listItemEnter(index)}>
          <TeamRow
            team={team}
            onEdit={() => setSheet({ kind: 'edit', team })}
            onArchive={() => setArchiving(team)}
            onRestore={() => change(team, true)}
            restoring={setActive.isPending && setActive.variables?.team.id === team.id}
          />
        </motion.li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="Teams" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            title="Teams"
            detail="Put people on a team from People. Teams drive the team filters, capacity and reports."
          />
          <Button
            variant="primary"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => setSheet({ kind: 'add' })}
          >
            Add team
          </Button>
        </div>
        {active.length === 0 ? (
          <EmptyState
            size="section"
            drawing="chair"
            title="No teams yet"
            description="Add the groups your studio works in, such as Design, Site or Procurement, then put people on them from People."
          />
        ) : (
          list(active)
        )}
      </section>
      {archived.length > 0 && (
        <section aria-label="Archived teams" className="flex flex-col gap-4">
          <SectionHeading
            title="Archived"
            detail="Not offered for anyone. People who have left keep these teams on their record."
          />
          {list(archived)}
        </section>
      )}
      <TeamSheet
        mode={sheet}
        onClose={() => setSheet(null)}
        onRefresh={() => void teams.refetch()}
      />
      <ArchiveTeamDialog
        team={archiving}
        pending={setActive.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={(team) => change(team, false)}
      />
    </div>
  );
}
