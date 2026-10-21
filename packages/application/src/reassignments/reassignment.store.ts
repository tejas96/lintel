import type { ReassignmentStatus } from '@lintel/domain';

export interface ReassignmentRequestRecord {
  readonly id: string;
  readonly taskId: string;
  readonly projectId: string;
  readonly requestedByUserId: string;
  readonly ownerAtRequestUserId: string | null;
  readonly suggestedUserId: string | null;
  readonly reason: string;
  readonly status: ReassignmentStatus;
  readonly decidedByUserId: string | null;
  readonly decisionNote: string | null;
  readonly newOwnerUserId: string | null;
  readonly version: number;
}

export interface NewReassignmentRequest {
  readonly taskId: string;
  readonly projectId: string;
  readonly requestedByUserId: string;
  readonly ownerAtRequestUserId: string | null;
  readonly suggestedUserId: string | null;
  readonly reason: string;
}

/** How an open request ends: decided by a manager, or withdrawn by the person who asked. */
export interface ReassignmentResolution {
  readonly status: Exclude<ReassignmentStatus, 'open'>;
  readonly decidedByUserId: string | null;
  readonly at: Date;
  readonly note: string | null;
  readonly newOwnerUserId: string | null;
}

/** Write-side persistence for task reassignment requests. */
export interface ReassignmentStore {
  insert(request: NewReassignmentRequest): Promise<ReassignmentRequestRecord>;
  find(requestId: string): Promise<ReassignmentRequestRecord | null>;
  /** Locks the request row until the transaction ends. */
  findForUpdate(requestId: string): Promise<ReassignmentRequestRecord | null>;
  openForTask(taskId: string): Promise<ReassignmentRequestRecord | null>;
  /** Only an open request with the expected version moves; false otherwise. */
  resolve(
    requestId: string,
    expectedVersion: number,
    resolution: ReassignmentResolution,
  ): Promise<boolean>;
}
