import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DatabaseExecutor } from '../../client';
import { projectTemplateUpdates, workflowTemplateVersions } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface TemplateUpdateHistoryView {
  readonly id: string;
  readonly fromVersionNumber: number;
  readonly toVersionNumber: number;
  readonly appliedBy: UserSummaryView | null;
  readonly appliedAt: string;
  readonly added: number;
  readonly changed: number;
  readonly cancelled: number;
  readonly heldBack: number;
  readonly extendedPlannedEndTo: string | null;
}

const fromVersion = alias(workflowTemplateVersions, 'from_version');
const toVersion = alias(workflowTemplateVersions, 'to_version');

/** Every template update applied to a project, newest first. Callers check access first. */
export async function listTemplateUpdateHistory(
  db: DatabaseExecutor,
  projectId: string,
): Promise<TemplateUpdateHistoryView[]> {
  const rows = await db
    .select({
      update: projectTemplateUpdates,
      fromNumber: fromVersion.versionNumber,
      toNumber: toVersion.versionNumber,
    })
    .from(projectTemplateUpdates)
    .innerJoin(fromVersion, eq(fromVersion.id, projectTemplateUpdates.fromVersionId))
    .innerJoin(toVersion, eq(toVersion.id, projectTemplateUpdates.toVersionId))
    .where(eq(projectTemplateUpdates.projectId, projectId))
    .orderBy(desc(projectTemplateUpdates.createdAt));
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.update.appliedByUserId),
  );
  return rows.map(({ update, fromNumber, toNumber }) => ({
    id: update.id,
    fromVersionNumber: fromNumber,
    toVersionNumber: toNumber,
    appliedBy: pickUser(people, update.appliedByUserId),
    appliedAt: update.createdAt.toISOString(),
    added: update.summary.added,
    changed: update.summary.changed,
    cancelled: update.summary.cancelled,
    heldBack: update.summary.heldBack,
    extendedPlannedEndTo: update.summary.extendedPlannedEndTo,
  }));
}
