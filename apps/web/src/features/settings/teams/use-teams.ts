'use client';

import type { Team } from '@lintel/api-contracts';
import type { TeamDefinition } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';

/** Every team, archived ones too. Shares the `teams` prefix so one refresh covers all lists. */
export const allTeamsKey = [...queryKeys.teams, 'all'] as const;

export type TeamChanges = Partial<TeamDefinition>;

export function useAllTeams() {
  return useQuery({
    queryKey: allTeamsKey,
    queryFn: () => expectStatus(api.teams.listTeams({ query: { status: 'all' } }), 200),
  });
}

/**
 * Every change refreshes the team lists people choose from (person sheet,
 * People and report filters) and the directory, which shows team names.
 */
export function useTeamMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.teams });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allPeople });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allReports });
  };
  const create = useMutation({
    mutationFn: (definition: TeamDefinition) =>
      expectStatus(api.teams.createTeam({ body: definition }), 201),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (input: { team: Team; changes: TeamChanges }) =>
      expectStatus(
        api.teams.updateTeam({
          params: { id: input.team.id },
          body: { ...input.changes, version: input.team.version },
        }),
        200,
      ),
    onSuccess: refresh,
  });
  const setActive = useMutation({
    mutationFn: ({ team, active }: { team: Team; active: boolean }) => {
      const request = { params: { id: team.id }, body: { version: team.version } };
      return active
        ? expectStatus(api.teams.restoreTeam(request), 200)
        : expectStatus(api.teams.archiveTeam(request), 200);
    },
    onSuccess: refresh,
  });
  return { create, update, setActive };
}
