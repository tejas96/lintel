import type { ClientSignOffMethod } from '@lintel/domain';
import { desc, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { scopeChangeClientSignOffs } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface ClientSignOffView {
  readonly id: string;
  readonly confirmedByName: string;
  readonly method: ClientSignOffMethod;
  readonly confirmedOn: string;
  readonly note: string | null;
  readonly recordedBy: UserSummaryView | null;
  readonly recordedAt: string;
}

/** Every client sign-off of the given scope changes, newest first, keyed by scope change. */
export async function loadClientSignOffViews(
  db: DatabaseExecutor,
  scopeChangeIds: readonly string[],
): Promise<Map<string, ClientSignOffView[]>> {
  const byChange = new Map<string, ClientSignOffView[]>();
  if (scopeChangeIds.length === 0) return byChange;
  const rows = await db
    .select()
    .from(scopeChangeClientSignOffs)
    .where(inArray(scopeChangeClientSignOffs.scopeChangeId, [...scopeChangeIds]))
    .orderBy(desc(scopeChangeClientSignOffs.recordedAt));
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.recordedByUserId),
  );
  for (const row of rows) {
    const list = byChange.get(row.scopeChangeId) ?? [];
    list.push({
      id: row.id,
      confirmedByName: row.confirmedByName,
      method: row.method,
      confirmedOn: row.confirmedOn,
      note: row.note,
      recordedBy: pickUser(people, row.recordedByUserId),
      recordedAt: row.recordedAt.toISOString(),
    });
    byChange.set(row.scopeChangeId, list);
  }
  return byChange;
}
