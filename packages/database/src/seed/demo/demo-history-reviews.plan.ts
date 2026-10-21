import { clockTime, type HistoryClock, plusHours, stableHash } from './demo-history-time';

/** Hours a reviewer took, picked per deliverable: same-day turnarounds and next-day ones. */
const REVIEW_WAIT_HOURS = [3, 4, 5, 6, 8, 11, 18, 20, 22, 24, 26, 30] as const;

const CHANGE_REQUESTS = [
  'Please align the dimensions with the latest site measurements and resubmit.',
  'Material callouts are missing on two sheets. Add them and send it again.',
  'Update the legend and the revision block before this goes to the client.',
  'The client prefers the warmer palette we discussed. Please revise.',
] as const;

export interface PlannedVersion {
  readonly submittedAt: Date;
  readonly note: string | null;
  readonly reviewedAt: Date;
  readonly decision: 'approved' | 'changes_requested';
  readonly comment: string | null;
}

/**
 * One deliverable's review history ahead of its task's completion: version 1
 * about a working day before (two when it needed rework), decided 3–30 hours
 * later. About a quarter (of those that `mayRework`) come back with changes;
 * version 2 follows roughly a day later and is approved. Nothing lands in
 * the future.
 */
export function planReviewHistory(
  input: { key: string; startedAt: Date | null; completedAt: Date; mayRework: boolean },
  clock: HistoryClock,
): PlannedVersion[] {
  const roll = stableHash(`${input.key}/review`);
  const reworked = input.mayRework && roll % 4 === 0;
  const firstDay = clock.shift(clock.dateOf(input.completedAt), reworked ? -2 : -1);
  let submittedAt = clock.at(
    firstDay,
    clockTime(11 * 60 + ((roll >>> 4) % 5) * 60 + ((roll >>> 7) % 4) * 15),
  );
  const earliest = input.startedAt ? plusHours(input.startedAt, 2) : null;
  if (earliest && submittedAt < earliest) submittedAt = earliest;
  submittedAt = clock.past(submittedAt);
  const wait = REVIEW_WAIT_HOURS[(roll >>> 9) % REVIEW_WAIT_HOURS.length] ?? 6;
  const firstReview = clock.past(plusHours(submittedAt, wait));
  if (!reworked) {
    return [
      {
        submittedAt,
        note: (roll >>> 21) % 3 === 0 ? 'Ready for review.' : null,
        reviewedAt: firstReview,
        decision: 'approved',
        comment: null,
      },
    ];
  }
  const nextDay = plusHours(submittedAt, 24);
  const afterComments = plusHours(firstReview, 3);
  const resubmittedAt = clock.past(nextDay > afterComments ? nextDay : afterComments);
  return [
    {
      submittedAt,
      note: 'First issue for review.',
      reviewedAt: firstReview,
      decision: 'changes_requested',
      comment: CHANGE_REQUESTS[(roll >>> 13) % CHANGE_REQUESTS.length] ?? CHANGE_REQUESTS[0],
    },
    {
      submittedAt: resubmittedAt,
      note: 'Revised as per the review comments.',
      reviewedAt: clock.past(plusHours(resubmittedAt, 3 + ((roll >>> 17) % 12))),
      decision: 'approved',
      comment: null,
    },
  ];
}

/** "Working drawing set" → "working-drawing-set". */
export function fileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
