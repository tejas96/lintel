import { describe, expect, it } from 'vitest';
import { checkDeliverableReview, type ReviewRequest } from './deliverable-review';

const request: ReviewRequest = {
  deliverableStatus: 'in_review',
  versionSubmittedBy: 'designer',
  reviewerId: 'lead',
  isAssignedReviewer: true,
  canReviewAny: false,
  decision: 'approved',
  comment: null,
};

describe('deliverable review', () => {
  it('lets the assigned reviewer approve', () => {
    expect(checkDeliverableReview(request)).toEqual({ allowed: true, nextStatus: 'approved' });
  });

  it('never allows self-review', () => {
    expect(checkDeliverableReview({ ...request, reviewerId: 'designer' }).allowed).toBe(false);
  });

  it('requires a comment when asking for changes', () => {
    const result = checkDeliverableReview({ ...request, decision: 'changes_requested' });
    expect(result.allowed).toBe(false);
  });

  it('only decides deliverables that are in review', () => {
    expect(checkDeliverableReview({ ...request, deliverableStatus: 'approved' }).allowed).toBe(
      false,
    );
  });
});
