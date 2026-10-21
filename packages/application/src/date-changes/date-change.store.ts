import type { DateChangeStatus } from '@lintel/domain';

export interface DateChangeRequestRecord {
  readonly id: string;
  readonly taskId: string;
  readonly projectId: string;
  readonly requestedByUserId: string;
  readonly previousStartDate: string | null;
  readonly previousDueDate: string | null;
  readonly proposedStartDate: string | null;
  readonly proposedDueDate: string;
  readonly reason: string;
  readonly status: DateChangeStatus;
  readonly decidedByUserId: string | null;
  readonly decisionNote: string | null;
  readonly version: number;
}

export type NewDateChangeRequest = Pick<
  DateChangeRequestRecord,
  | 'taskId'
  | 'projectId'
  | 'requestedByUserId'
  | 'previousStartDate'
  | 'previousDueDate'
  | 'proposedStartDate'
  | 'proposedDueDate'
  | 'reason'
>;

/** How an open request ends: decided by a manager, or withdrawn by the person who asked. */
export interface DateChangeResolution {
  readonly status: Exclude<DateChangeStatus, 'open'>;
  readonly decidedByUserId: string | null;
  readonly at: Date;
  readonly note: string | null;
}

/** Write-side persistence for new-date requests. */
export interface DateChangeStore {
  insert(request: NewDateChangeRequest): Promise<DateChangeRequestRecord>;
  find(requestId: string): Promise<DateChangeRequestRecord | null>;
  /** Locks the request row until the transaction ends. */
  findForUpdate(requestId: string): Promise<DateChangeRequestRecord | null>;
  openForTask(taskId: string): Promise<DateChangeRequestRecord | null>;
  /** Only an open request with the expected version moves; false otherwise. */
  resolve(
    requestId: string,
    expectedVersion: number,
    resolution: DateChangeResolution,
  ): Promise<boolean>;
}
