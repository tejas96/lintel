'use client';

import type { DeliverableDetail } from '@lintel/api-contracts';
import type { PillTone, StatusGlyphName } from '@lintel/design-system/web';
import type { DeliverableStatus } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export const DELIVERABLE_STATUS: Readonly<
  Record<DeliverableStatus, { tone: PillTone; glyph: StatusGlyphName; label: string }>
> = {
  not_submitted: { tone: 'neutral', glyph: 'ready', label: 'Not submitted' },
  in_review: { tone: 'review', glyph: 'review', label: 'In review' },
  changes_requested: { tone: 'atRisk', glyph: 'changes', label: 'Changes requested' },
  approved: { tone: 'onTrack', glyph: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', glyph: 'offTrack', label: 'Rejected' },
  cancelled: { tone: 'neutral', glyph: 'cancelled', label: 'Cancelled' },
};

export const DECISION_LABELS = {
  pending: 'Waiting for review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
} as const;

export function useProjectDeliverables(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectDeliverables(projectId),
    queryFn: () =>
      expectStatus(api.deliverables.listProjectDeliverables({ params: { id: projectId } }), 200),
  });
}

export function useDeliverable(deliverableId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.deliverable(deliverableId),
    queryFn: () =>
      expectStatus(api.deliverables.getDeliverable({ params: { id: deliverableId } }), 200),
    enabled,
  });
}

/** Submit a new version or decide on one; both refresh the project's deliverables. */
export function useDeliverableMutations(projectId: string) {
  const queryClient = useQueryClient();
  const fail = useFailureToast();
  const settle = (detail: DeliverableDetail) => {
    queryClient.setQueryData(queryKeys.deliverable(detail.id), detail);
    void queryClient.invalidateQueries({ queryKey: queryKeys.projectDeliverables(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
  };
  const submitVersion = useMutation({
    mutationFn: (input: {
      deliverableId: string;
      fileId: string;
      note: string | null;
      version: number;
    }) =>
      expectStatus(
        api.deliverables.submitDeliverableVersion({
          params: { id: input.deliverableId },
          body: { fileId: input.fileId, note: input.note, version: input.version },
        }),
        201,
      ),
    onSuccess: settle,
    onError: (error) =>
      fail(error, 'submit the version', [queryKeys.projectDeliverables(projectId)]),
  });
  const review = useMutation({
    mutationFn: (input: {
      versionId: string;
      decision: 'approved' | 'changes_requested' | 'rejected';
      comment: string | null;
      version: number;
    }) =>
      expectStatus(
        api.deliverables.reviewDeliverableVersion({
          params: { id: input.versionId },
          body: { decision: input.decision, comment: input.comment, version: input.version },
        }),
        200,
      ),
    onSuccess: settle,
    onError: (error) =>
      fail(error, 'record the decision', [queryKeys.projectDeliverables(projectId)]),
  });
  return { submitVersion, review };
}
