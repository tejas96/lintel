export const DELIVERABLE_STATUSES = [
  'not_submitted',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export const REVIEW_DECISIONS = ['approved', 'changes_requested', 'rejected'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface ReviewRequest {
  readonly deliverableStatus: DeliverableStatus;
  readonly versionSubmittedBy: string;
  readonly reviewerId: string;
  readonly isAssignedReviewer: boolean;
  readonly canReviewAny: boolean;
  readonly decision: ReviewDecision;
  readonly comment: string | null;
}

export type ReviewCheck =
  | { readonly allowed: true; readonly nextStatus: DeliverableStatus }
  | { readonly allowed: false; readonly reason: string };

/**
 * Rules for deciding on a submitted deliverable version. Nobody approves their
 * own work, and anything other than approval needs a written reason.
 */
export function checkDeliverableReview(request: ReviewRequest): ReviewCheck {
  if (request.deliverableStatus !== 'in_review') {
    return { allowed: false, reason: 'Only a deliverable that is in review can be decided.' };
  }
  if (request.versionSubmittedBy === request.reviewerId) {
    return { allowed: false, reason: 'You cannot review your own submission.' };
  }
  if (!request.isAssignedReviewer && !request.canReviewAny) {
    return { allowed: false, reason: 'Only the assigned reviewer can decide on this deliverable.' };
  }
  if (request.decision !== 'approved' && (request.comment ?? '').trim().length < 3) {
    return { allowed: false, reason: 'Explain what needs to change.' };
  }
  return { allowed: true, nextStatus: request.decision };
}

/** A new version may be submitted unless the deliverable is approved or cancelled. */
export function canSubmitDeliverableVersion(status: DeliverableStatus): boolean {
  return status !== 'approved' && status !== 'cancelled' && status !== 'in_review';
}
