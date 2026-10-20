import type {
  DeliverableChanges,
  DeliverableStore,
  NewDeliverable,
  NewFile,
  NewSiteUpdate,
} from '@lintel/application';
import type { ReviewDecision } from '@lintel/domain';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { deliverables, deliverableVersions, files, siteUpdatePhotos, siteUpdates } from '../schema';

const fileColumns = {
  id: files.id,
  storageKey: files.storageKey,
  originalName: files.originalName,
  contentType: files.contentType,
  sizeBytes: files.sizeBytes,
  projectId: files.projectId,
  visibility: files.visibility,
  status: files.status,
  uploadedByUserId: files.uploadedByUserId,
};

const deliverableColumns = {
  id: deliverables.id,
  projectId: deliverables.projectId,
  taskId: deliverables.taskId,
  name: deliverables.name,
  isRequired: deliverables.isRequired,
  status: deliverables.status,
  reviewerUserId: deliverables.reviewerUserId,
  currentVersionNumber: deliverables.currentVersionNumber,
  version: deliverables.version,
};

const versionColumns = {
  id: deliverableVersions.id,
  deliverableId: deliverableVersions.deliverableId,
  versionNumber: deliverableVersions.versionNumber,
  fileId: deliverableVersions.fileId,
  submittedByUserId: deliverableVersions.submittedByUserId,
  decision: deliverableVersions.decision,
};

/** Files, deliverables, versions and site updates. */
export class DeliverableRepository implements DeliverableStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async createFile(file: NewFile) {
    const [row] = await this.db.insert(files).values(file).returning(fileColumns);
    if (!row) throw new Error('Saving the file returned no row.');
    return row;
  }

  async findFile(fileId: string) {
    const [row] = await this.db
      .select(fileColumns)
      .from(files)
      .where(and(eq(files.id, fileId), isNull(files.deletedAt)));
    return row ?? null;
  }

  async claimFileForProject(fileId: string, projectId: string) {
    await this.db
      .update(files)
      .set({
        projectId,
        visibility: sql`case when ${files.visibility} = 'private' then 'project'::file_visibility else ${files.visibility} end`,
      })
      .where(and(eq(files.id, fileId), isNull(files.projectId)));
  }

  async createDeliverable(deliverable: NewDeliverable) {
    const [row] = await this.db
      .insert(deliverables)
      .values(deliverable)
      .returning(deliverableColumns);
    if (!row) throw new Error('Saving the deliverable returned no row.');
    return row;
  }

  async findDeliverable(deliverableId: string) {
    const [row] = await this.db
      .select(deliverableColumns)
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId));
    return row ?? null;
  }

  async findDeliverableForUpdate(deliverableId: string) {
    const [row] = await this.db
      .select(deliverableColumns)
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId))
      .for('update');
    return row ?? null;
  }

  async updateDeliverable(
    deliverableId: string,
    expectedVersion: number,
    changes: DeliverableChanges,
  ) {
    const [row] = await this.db
      .update(deliverables)
      .set({ ...changes, version: sql`${deliverables.version} + 1`, updatedAt: new Date() })
      .where(and(eq(deliverables.id, deliverableId), eq(deliverables.version, expectedVersion)))
      .returning(deliverableColumns);
    return row ?? null;
  }

  async addVersion(input: {
    readonly deliverableId: string;
    readonly versionNumber: number;
    readonly fileId: string;
    readonly note: string | null;
    readonly submittedByUserId: string;
  }) {
    const [row] = await this.db.insert(deliverableVersions).values(input).returning(versionColumns);
    if (!row) throw new Error('Saving the version returned no row.');
    return row;
  }

  async findVersion(versionId: string) {
    const [row] = await this.db
      .select(versionColumns)
      .from(deliverableVersions)
      .where(eq(deliverableVersions.id, versionId));
    return row ?? null;
  }

  async latestVersion(deliverableId: string) {
    const [row] = await this.db
      .select(versionColumns)
      .from(deliverableVersions)
      .where(eq(deliverableVersions.deliverableId, deliverableId))
      .orderBy(desc(deliverableVersions.versionNumber))
      .limit(1);
    return row ?? null;
  }

  async decideVersion(
    versionId: string,
    decision: {
      readonly decision: ReviewDecision;
      readonly byUserId: string;
      readonly at: Date;
      readonly comment: string | null;
    },
  ) {
    await this.db
      .update(deliverableVersions)
      .set({
        decision: decision.decision,
        reviewedByUserId: decision.byUserId,
        reviewedAt: decision.at,
        reviewComment: decision.comment,
      })
      .where(eq(deliverableVersions.id, versionId));
  }

  async createSiteUpdate(update: NewSiteUpdate) {
    const { photoFileIds, ...values } = update;
    const [row] = await this.db
      .insert(siteUpdates)
      .values(values)
      .returning({ id: siteUpdates.id });
    if (!row) throw new Error('Saving the site update returned no row.');
    if (photoFileIds.length > 0) {
      await this.db
        .insert(siteUpdatePhotos)
        .values(
          photoFileIds.map((fileId, position) => ({ siteUpdateId: row.id, fileId, position })),
        );
    }
    return row;
  }
}
