import type { DeliverableDetail, DeliverableVersion } from '@lintel/api-contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

type ReviewDecision = Exclude<DeliverableVersion['decision'], 'pending'>;

function useApplyDeliverableChange() {
  const queryClient = useQueryClient();
  return (deliverable: DeliverableDetail) => {
    queryClient.setQueryData(queryKeys.deliverable(deliverable.id), deliverable);
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.projectDeliverables(deliverable.project.id),
    });
    if (deliverable.task) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(deliverable.task.id) });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
  };
}

export function useDeliverable(deliverableId: string) {
  return useQuery({
    queryKey: queryKeys.deliverable(deliverableId),
    queryFn: ({ signal }) =>
      unwrap(
        api.deliverables.getDeliverable({
          params: { id: deliverableId },
          fetchOptions: { signal },
        }),
      ),
  });
}

export function useSubmitDeliverableVersion(deliverableId: string) {
  const apply = useApplyDeliverableChange();
  return useMutation({
    mutationFn: (input: { fileId: string; note: string | null; version: number }) =>
      unwrap(
        api.deliverables.submitDeliverableVersion({ params: { id: deliverableId }, body: input }),
      ),
    onSuccess: apply,
  });
}

/** Self-review is refused by the server; the screen only offers it when `viewerCanReview`. */
export function useReviewDeliverableVersion() {
  const apply = useApplyDeliverableChange();
  return useMutation({
    mutationFn: (input: {
      versionId: string;
      decision: ReviewDecision;
      comment: string | null;
      version: number;
    }) =>
      unwrap(
        api.deliverables.reviewDeliverableVersion({
          params: { id: input.versionId },
          body: { decision: input.decision, comment: input.comment, version: input.version },
        }),
      ),
    onSuccess: apply,
  });
}
