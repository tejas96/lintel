import type { LeaveTypeAdminRecord, LeaveTypeChanges, LeaveTypeStore } from '@lintel/application';
import type { LeaveTypeDefinition } from '@lintel/domain';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { leaveTypes } from '../schema';

const columns = {
  id: leaveTypes.id,
  code: leaveTypes.code,
  name: leaveTypes.name,
  description: leaveTypes.description,
  requiresReason: leaveTypes.requiresReason,
  allowsHalfDay: leaveTypes.allowsHalfDay,
  minimumNoticeDays: leaveTypes.minimumNoticeDays,
  annualAllowanceHalfDays: leaveTypes.annualAllowanceHalfDays,
  colorIndex: leaveTypes.colorIndex,
  isActive: leaveTypes.isActive,
  version: leaveTypes.version,
};

/** Leave type administration. Types are never deleted: requests keep pointing at them. */
export class LeaveTypeRepository implements LeaveTypeStore {
  constructor(private readonly db: DatabaseExecutor) {}

  list(): Promise<LeaveTypeAdminRecord[]> {
    return this.db
      .select(columns)
      .from(leaveTypes)
      .orderBy(desc(leaveTypes.isActive), asc(leaveTypes.name));
  }

  async find(leaveTypeId: string): Promise<LeaveTypeAdminRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(leaveTypes)
      .where(eq(leaveTypes.id, leaveTypeId));
    return row ?? null;
  }

  async create(input: LeaveTypeDefinition & { readonly code: string }) {
    const [row] = await this.db.insert(leaveTypes).values(input).returning(columns);
    if (!row) throw new Error('Creating the leave type returned no row.');
    return row;
  }

  async update(leaveTypeId: string, expectedVersion: number, changes: LeaveTypeChanges) {
    const [row] = await this.db
      .update(leaveTypes)
      .set({ ...changes, version: sql`${leaveTypes.version} + 1`, updatedAt: new Date() })
      .where(and(eq(leaveTypes.id, leaveTypeId), eq(leaveTypes.version, expectedVersion)))
      .returning(columns);
    return row ?? null;
  }
}
