import { challengeRefusal, type RewardRecordKind } from '@lintel/domain';
import { asc, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { type ChallengeRecordSnapshot, rewardChallenges } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';

type ChallengeRow = typeof rewardChallenges.$inferSelect;

/** A snapshot with the amount removed unless the viewer may see it. */
export function snapshotView(snapshot: ChallengeRecordSnapshot, showAmounts: boolean) {
  return {
    status: snapshot.status,
    grantedAmountMinor: showAmounts ? snapshot.grantedAmountMinor : null,
    decisionNote: snapshot.decisionNote,
  };
}

/** One challenge as the contract's history entry. */
export function challengeEntryView(
  row: ChallengeRow,
  people: Awaited<ReturnType<typeof loadUserSummaries>>,
  showAmounts: boolean,
) {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    raisedBy: pickUser(people, row.raisedByUserId),
    createdAt: row.createdAt.toISOString(),
    before: snapshotView(row.recordBefore, showAmounts),
    after: row.recordAfter ? snapshotView(row.recordAfter, showAmounts) : null,
    resolvedBy: pickUser(people, row.resolvedByUserId),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    version: row.version,
  };
}

export type ChallengeEntryView = ReturnType<typeof challengeEntryView>;

/**
 * Every challenge of the given records, oldest first, keyed by record ID.
 * `showAmounts(recordId)` decides whether snapshots keep their amounts.
 */
export async function loadChallengeEntries(
  db: DatabaseExecutor,
  kind: RewardRecordKind,
  recordIds: readonly string[],
  showAmounts: (recordId: string) => boolean,
): Promise<Map<string, ChallengeEntryView[]>> {
  if (recordIds.length === 0) return new Map();
  const column =
    kind === 'evaluation' ? rewardChallenges.evaluationId : rewardChallenges.milestoneRecipientId;
  const rows = await db
    .select()
    .from(rewardChallenges)
    .where(inArray(column, [...recordIds]))
    .orderBy(asc(rewardChallenges.createdAt));
  const people = await loadUserSummaries(
    db,
    rows.flatMap((row) => [row.raisedByUserId, row.resolvedByUserId]),
  );
  const byRecord = new Map<string, ChallengeEntryView[]>();
  for (const row of rows) {
    const recordId = (kind === 'evaluation' ? row.evaluationId : row.milestoneRecipientId) ?? '';
    const list = byRecord.get(recordId) ?? [];
    list.push(challengeEntryView(row, people, showAmounts(recordId)));
    byRecord.set(recordId, list);
  }
  return byRecord;
}

/** Whether the viewer may challenge now — the server's decision, with the reason in words. */
export function challengeabilityOf(input: {
  readonly status: string;
  readonly grantedAmountMinor: number | null;
  readonly isSubject: boolean;
  readonly history: readonly ChallengeEntryView[];
}) {
  const reason = challengeRefusal({
    record: { status: input.status, grantedAmountMinor: input.grantedAmountMinor },
    isSubject: input.isSubject,
    hasOpenChallenge: input.history.some((entry) => entry.status === 'open'),
    challengesSoFar: input.history.length,
  });
  return { allowed: reason === null, reason };
}
