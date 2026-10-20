import {
  type Actor,
  canSubmitDeliverableVersion,
  checkDeliverableReview,
  type DeliverableStatus,
} from '@lintel/domain';
import { NotFoundError, PreconditionFailedError } from '@lintel/shared';
import { type ProjectAccess, ProjectAccessService } from '../access/project-access.service';
import type { OperationsStores } from '../tasks/operations-context';
import type { DeliverableRecord, DeliverableVersionRecord } from './deliverable.store';

type Stores = Pick<OperationsStores, 'access' | 'tasks' | 'deliverables'>;

export async function loadDeliverableForActor(
  stores: Stores,
  actor: Actor,
  deliverableId: string,
  lock: boolean,
  entity = 'Deliverable',
): Promise<{ deliverable: DeliverableRecord; access: ProjectAccess }> {
  const deliverable = lock
    ? await stores.deliverables.findDeliverableForUpdate(deliverableId)
    : await stores.deliverables.findDeliverable(deliverableId);
  if (!deliverable) throw new NotFoundError(entity);
  const access = await new ProjectAccessService(stores.access).requireView(
    actor,
    deliverable.projectId,
    entity,
  );
  return { deliverable, access };
}

/**
 * Who may submit a version: a manager, the owner or a collaborator of the
 * deliverable's task, or any project member for a project-level deliverable.
 */
export async function maySubmitDeliverable(
  stores: Stores,
  actor: Actor,
  deliverable: DeliverableRecord,
  access: ProjectAccess,
): Promise<boolean> {
  if (access.canManage) return true;
  if (!deliverable.taskId) {
    return access.projectRole !== null || access.managerUserId === actor.userId;
  }
  const task = await stores.tasks.find(deliverable.taskId);
  if (!task) return false;
  if (task.ownerUserId === actor.userId) return true;
  return (await stores.tasks.collaboratorIds(task.id)).includes(actor.userId);
}

const NOT_SUBMITTABLE: Partial<Record<DeliverableStatus, string>> = {
  in_review: 'A version is already waiting for review.',
  approved: 'This deliverable is already approved.',
  cancelled: 'This deliverable was cancelled.',
};

export function assertSubmittable(status: DeliverableStatus): void {
  if (!canSubmitDeliverableVersion(status)) {
    throw new PreconditionFailedError(NOT_SUBMITTABLE[status] ?? 'A new version cannot be added.');
  }
}

/** Whether the viewer could decide on the latest version right now (approval needs no comment). */
export function mayReviewDeliverable(
  actor: Actor,
  deliverable: DeliverableRecord,
  latest: DeliverableVersionRecord | null,
  access: Pick<ProjectAccess, 'canManage'>,
): boolean {
  if (latest?.decision !== 'pending') return false;
  return checkDeliverableReview({
    deliverableStatus: deliverable.status,
    versionSubmittedBy: latest.submittedByUserId,
    reviewerId: actor.userId,
    isAssignedReviewer: deliverable.reviewerUserId === actor.userId,
    canReviewAny: access.canManage,
    decision: 'approved',
    comment: null,
  }).allowed;
}

export interface DeliverableViewerState {
  readonly viewerCanReview: boolean;
  readonly viewerCanSubmit: boolean;
}

/** What the viewer may do with a deliverable. Throws 404 when it is missing or hidden. */
export class DeliverableViewerQuery {
  constructor(private readonly stores: Stores) {}

  async execute(actor: Actor, deliverableId: string): Promise<DeliverableViewerState> {
    const { deliverable, access } = await loadDeliverableForActor(
      this.stores,
      actor,
      deliverableId,
      false,
    );
    const latest = await this.stores.deliverables.latestVersion(deliverable.id);
    return {
      viewerCanReview: mayReviewDeliverable(actor, deliverable, latest, access),
      viewerCanSubmit:
        canSubmitDeliverableVersion(deliverable.status) &&
        (await maySubmitDeliverable(this.stores, actor, deliverable, access)),
    };
  }
}
