import type { DeliverableStatus, ReviewDecision } from '@lintel/domain';

export type FileVisibility = 'project' | 'confidential' | 'private';

export interface FileRecord {
  readonly id: string;
  readonly storageKey: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly projectId: string | null;
  readonly visibility: FileVisibility;
  readonly status: 'available' | 'deleted';
  readonly uploadedByUserId: string;
}

export interface NewFile {
  readonly storageKey: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly projectId: string | null;
  readonly visibility: FileVisibility;
  readonly uploadedByUserId: string;
}

export interface DeliverableRecord {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly name: string;
  readonly isRequired: boolean;
  readonly status: DeliverableStatus;
  readonly reviewerUserId: string | null;
  readonly currentVersionNumber: number;
  readonly version: number;
}

export interface NewDeliverable {
  readonly projectId: string;
  readonly taskId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly isRequired: boolean;
  readonly reviewerUserId: string | null;
}

export interface DeliverableVersionRecord {
  readonly id: string;
  readonly deliverableId: string;
  readonly versionNumber: number;
  readonly fileId: string;
  readonly submittedByUserId: string;
  readonly decision: 'pending' | ReviewDecision;
}

export interface DeliverableChanges {
  readonly status: DeliverableStatus;
  readonly currentVersionNumber?: number;
  readonly approvedAt?: Date | null;
}

export interface NewSiteUpdate {
  readonly projectId: string;
  readonly taskId: string | null;
  readonly authorUserId: string;
  readonly note: string;
  readonly hasIssue: boolean;
  readonly photoFileIds: readonly string[];
}

/** Files, deliverables with their versions, and site updates. */
export interface DeliverableStore {
  createFile(file: NewFile): Promise<FileRecord>;
  findFile(fileId: string): Promise<FileRecord | null>;
  /** Scopes an unscoped upload to a project ("private" becomes "project"). */
  claimFileForProject(fileId: string, projectId: string): Promise<void>;
  createDeliverable(deliverable: NewDeliverable): Promise<DeliverableRecord>;
  findDeliverable(deliverableId: string): Promise<DeliverableRecord | null>;
  /** Locks the deliverable row until the transaction ends. */
  findDeliverableForUpdate(deliverableId: string): Promise<DeliverableRecord | null>;
  /** Applies the change only if `expectedVersion` still matches. Returns null on a stale version. */
  updateDeliverable(
    deliverableId: string,
    expectedVersion: number,
    changes: DeliverableChanges,
  ): Promise<DeliverableRecord | null>;
  addVersion(input: {
    readonly deliverableId: string;
    readonly versionNumber: number;
    readonly fileId: string;
    readonly note: string | null;
    readonly submittedByUserId: string;
  }): Promise<DeliverableVersionRecord>;
  findVersion(versionId: string): Promise<DeliverableVersionRecord | null>;
  latestVersion(deliverableId: string): Promise<DeliverableVersionRecord | null>;
  decideVersion(
    versionId: string,
    decision: {
      readonly decision: ReviewDecision;
      readonly byUserId: string;
      readonly at: Date;
      readonly comment: string | null;
    },
  ): Promise<void>;
  createSiteUpdate(update: NewSiteUpdate): Promise<{ id: string }>;
}
