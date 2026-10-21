import type { MilestoneRewardFactsRecord } from '@lintel/application';
import { DOCUMENT_FOLDERS, type DocumentFolder } from '@lintel/domain';
import { and, eq, gt, isNull, lte, ne, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { deliverables, milestones, projectDocuments, taskBlockers, tasks } from '../schema';

const isFolder = (value: string): value is DocumentFolder =>
  (DOCUMENT_FOLDERS as readonly string[]).includes(value);

/**
 * What the milestone reward rules look at, as it stood when the milestone was
 * completed: the deliverables of its (not cancelled) tasks, the project
 * document folders holding a document added by then and not archived before
 * then, and every blocker raised on its tasks before completion.
 */
export async function loadMilestoneRewardFacts(
  db: DatabaseExecutor,
  milestoneId: string,
  completedAt: Date,
): Promise<MilestoneRewardFactsRecord> {
  const [milestone] = await db
    .select({ projectId: milestones.projectId })
    .from(milestones)
    .where(eq(milestones.id, milestoneId));
  if (!milestone) return { deliverables: [], foldersOnFile: new Set(), blockers: [] };
  const ownWork = and(
    eq(tasks.milestoneId, milestoneId),
    ne(tasks.status, 'cancelled'),
    isNull(tasks.archivedAt),
  );
  // Sequential: this runs inside the completion transaction, on one connection.
  const deliverableRows = await db
    .select({
      name: deliverables.name,
      isRequired: deliverables.isRequired,
      versions: deliverables.currentVersionNumber,
      status: deliverables.status,
    })
    .from(deliverables)
    .innerJoin(tasks, eq(tasks.id, deliverables.taskId))
    .where(and(ownWork, ne(deliverables.status, 'cancelled')));
  const folderRows = await db
    .selectDistinct({ folder: projectDocuments.folder })
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, milestone.projectId),
        lte(projectDocuments.createdAt, completedAt),
        or(isNull(projectDocuments.archivedAt), gt(projectDocuments.archivedAt, completedAt)),
      ),
    );
  const blockerRows = await db
    .select({
      category: taskBlockers.category,
      waitingOnUserId: taskBlockers.waitingOnUserId,
      raisedAt: taskBlockers.raisedAt,
      resolvedAt: taskBlockers.resolvedAt,
    })
    .from(taskBlockers)
    .innerJoin(tasks, eq(tasks.id, taskBlockers.taskId))
    .where(and(ownWork, lte(taskBlockers.raisedAt, completedAt)));
  return {
    deliverables: deliverableRows.map((row) => ({
      name: row.name,
      isRequired: row.isRequired,
      submitted: row.versions > 0,
      approved: row.status === 'approved',
    })),
    foldersOnFile: new Set(folderRows.map((row) => row.folder).filter(isFolder)),
    blockers: blockerRows.map((row) => ({
      ...row,
      resolvedAt: row.resolvedAt && row.resolvedAt <= completedAt ? row.resolvedAt : null,
    })),
  };
}
