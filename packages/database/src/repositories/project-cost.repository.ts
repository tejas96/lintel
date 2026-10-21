import type {
  NewProjectCost,
  ProjectCostRecord,
  ProjectCostStore,
  ProjectCostVoid,
} from '@lintel/application';
import { StaleVersionError } from '@lintel/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { projectCostEntries } from '../schema';

type CostRow = typeof projectCostEntries.$inferSelect;

function toRecord(row: CostRow): ProjectCostRecord {
  const { updatedAt: _updated, ...record } = row;
  return record;
}

export class ProjectCostRepository implements ProjectCostStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(cost: NewProjectCost): Promise<ProjectCostRecord> {
    const [row] = await this.db.insert(projectCostEntries).values(cost).returning();
    if (!row) throw new Error('Saving the cost entry returned no row.');
    return toRecord(row);
  }

  async findInProject(projectId: string, costId: string): Promise<ProjectCostRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectCostEntries)
      .where(and(eq(projectCostEntries.id, costId), eq(projectCostEntries.projectId, projectId)));
    return row ? toRecord(row) : null;
  }

  async markVoid(change: ProjectCostVoid): Promise<ProjectCostRecord> {
    const [row] = await this.db
      .update(projectCostEntries)
      .set({
        voidedAt: change.at,
        voidedByUserId: change.voidedByUserId,
        voidReason: change.reason,
        version: sql`${projectCostEntries.version} + 1`,
        updatedAt: change.at,
      })
      .where(
        and(
          eq(projectCostEntries.id, change.costId),
          eq(projectCostEntries.version, change.expectedVersion),
          isNull(projectCostEntries.voidedAt),
        ),
      )
      .returning();
    if (!row) throw new StaleVersionError('This cost entry');
    return toRecord(row);
  }
}
