import type { FollowUpStore } from '@lintel/application';
import type { ReviewSubject } from '../workflows/workflow-contract';

/** A later submission than this counts as a new review round (with its own workflow). */
const SAME_ROUND_TOLERANCE_MS = 2 * 60 * 1000;

/** Everything a review follow-up needs, for task reviews and deliverable versions alike. */
export interface ReviewState {
  readonly pending: boolean;
  readonly submittedAt: Date;
  readonly reviewerUserId: string | null;
  readonly managerUserId: string;
  readonly title: string;
  readonly projectName: string;
  readonly submitterName: string | null;
  readonly linkPath: string;
  readonly subjectType: 'task' | 'deliverable';
  readonly subjectId: string;
  /** Distinguishes review rounds of the same subject in dedupe keys. */
  readonly roundKey: string;
}

export async function loadReviewState(
  followUps: FollowUpStore,
  subject: ReviewSubject,
): Promise<ReviewState | null> {
  if (subject.type === 'task') {
    const task = await followUps.taskReview(subject.taskId);
    if (!task) return null;
    const roundStart = Date.parse(subject.submittedAt);
    const newerRound =
      task.submittedAt !== null &&
      Number.isFinite(roundStart) &&
      task.submittedAt.getTime() - roundStart > SAME_ROUND_TOLERANCE_MS;
    return {
      pending: task.status === 'in_review' && !newerRound,
      submittedAt: task.submittedAt ?? new Date(roundStart),
      reviewerUserId: task.reviewerUserId,
      managerUserId: task.project.managerUserId,
      title: task.title,
      projectName: task.project.name,
      submitterName: task.ownerName,
      linkPath: `/tasks/${task.taskId}`,
      subjectType: 'task',
      subjectId: task.taskId,
      roundKey: subject.submittedAt,
    };
  }
  const version = await followUps.deliverableReview(subject.versionId);
  if (!version) return null;
  return {
    pending: version.decision === 'pending' && version.deliverableStatus === 'in_review',
    submittedAt: version.submittedAt,
    reviewerUserId: version.reviewerUserId,
    managerUserId: version.project.managerUserId,
    title: `${version.deliverableName} (v${version.versionNumber})`,
    projectName: version.project.name,
    submitterName: version.submittedByName,
    linkPath: `/deliverables/${version.deliverableId}`,
    subjectType: 'deliverable',
    subjectId: version.deliverableId,
    roundKey: version.versionId,
  };
}
