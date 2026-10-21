import type { ClientSignOffRecord } from '@lintel/application';
import type { ClientSignOff } from '@lintel/domain';
import { desc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { scopeChangeClientSignOffs } from '../schema';

type SignOffRow = typeof scopeChangeClientSignOffs.$inferSelect;

function toRecord(row: SignOffRow): ClientSignOffRecord {
  return {
    id: row.id,
    scopeChangeId: row.scopeChangeId,
    confirmedByName: row.confirmedByName,
    method: row.method,
    confirmedOn: row.confirmedOn as ClientSignOff['confirmedOn'],
    note: row.note,
    recordedByUserId: row.recordedByUserId,
    recordedAt: row.recordedAt,
  };
}

/** The latest client sign-off of a scope change; earlier ones stay as history. */
export async function latestScopeSignOff(
  db: DatabaseExecutor,
  scopeChangeId: string,
): Promise<ClientSignOffRecord | null> {
  const [row] = await db
    .select()
    .from(scopeChangeClientSignOffs)
    .where(eq(scopeChangeClientSignOffs.scopeChangeId, scopeChangeId))
    .orderBy(desc(scopeChangeClientSignOffs.recordedAt))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function insertScopeSignOff(
  db: DatabaseExecutor,
  signOff: ClientSignOff & { readonly scopeChangeId: string; readonly recordedByUserId: string },
): Promise<ClientSignOffRecord> {
  const [row] = await db
    .insert(scopeChangeClientSignOffs)
    .values({
      scopeChangeId: signOff.scopeChangeId,
      confirmedByName: signOff.confirmedByName,
      method: signOff.method,
      confirmedOn: signOff.confirmedOn,
      note: signOff.note,
      recordedByUserId: signOff.recordedByUserId,
    })
    .returning();
  if (!row) throw new Error('Saving the client sign-off returned no row.');
  return toRecord(row);
}
