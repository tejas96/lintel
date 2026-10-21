'use client';

import type { ProjectCostEntry, ProjectDetail } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import type { ProjectCostCategory } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { formatLongDate } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { formatMoney } from './finance-presentation';

/** The studio settings (open to everyone signed in). */
export function useOrganization() {
  return useQuery({
    queryKey: queryKeys.organization,
    queryFn: () => expectStatus(api.platform.getOrganization(), 200),
    staleTime: 60_000,
  });
}

/**
 * Whether this person may see this project's budget and costs: the same rule
 * the API applies (`projects.manage_any`, or the project's manager or owner).
 * The server still decides; this only avoids asking when the answer is no.
 */
export function useCanSeeFinances(project: ProjectDetail): boolean {
  const { user, can } = useSession();
  return (
    can('projects.manage_any') || project.manager.id === user.id || project.owner.id === user.id
  );
}

/** Budget against cost for a project, when profitability is on and the person may see it. */
export function useProjectProfitability(project: ProjectDetail) {
  const organization = useOrganization();
  const allowed = useCanSeeFinances(project);
  const enabled = allowed && organization.data?.profitabilityEnabled === true;
  const profitability = useQuery({
    queryKey: queryKeys.projectProfitability(project.id),
    queryFn: () =>
      expectStatus(
        api.projectCosts.getProjectProfitability({ params: { projectId: project.id } }),
        200,
      ),
    enabled,
  });
  return { enabled, profitability };
}

function useRefreshFinances(projectId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.projectProfitability(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allCommandCenters });
  };
}

export interface NewCost {
  readonly entryDate: string;
  readonly category: ProjectCostCategory;
  readonly amountMinor: number;
  readonly note: string | null;
}

export function useRecordCost(projectId: string) {
  const refresh = useRefreshFinances(projectId);
  const toast = useToast();
  return useMutation({
    mutationFn: (body: NewCost) =>
      expectStatus(api.projectCosts.recordProjectCost({ params: { projectId }, body }), 201),
    onSuccess: (entry) => {
      refresh();
      toast({
        tone: 'success',
        title: 'Cost recorded',
        description: `${formatMoney(entry.amountMinor, entry.currency)} on ${formatLongDate(entry.entryDate)}.`,
      });
    },
  });
}

export function useVoidCost(projectId: string) {
  const refresh = useRefreshFinances(projectId);
  const fail = useFailureToast();
  return useMutation({
    mutationFn: ({ entry, reason }: { entry: ProjectCostEntry; reason: string }) =>
      expectStatus(
        api.projectCosts.voidProjectCost({
          params: { projectId, costId: entry.id },
          body: { reason, version: entry.version },
        }),
        200,
      ),
    onSuccess: refresh,
    onError: (error) => fail(error, 'void the entry', [queryKeys.projectProfitability(projectId)]),
  });
}
