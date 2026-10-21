export interface WorkSessionRecord {
  readonly id: string;
  readonly taskId: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface PriorityConflictRecord {
  readonly id: string;
  readonly raisedByUserId: string;
  readonly taskIds: readonly string[];
  readonly note: string;
  readonly status: 'open' | 'resolved';
}

/** Time tracking sessions and priority conflicts raised by people about their own work. */
export interface WorkSessionStore {
  /** Serialises session changes for one person (locks their user row). */
  lockPerson(userId: string): Promise<void>;
  activeSessionFor(userId: string): Promise<WorkSessionRecord | null>;
  activeSessionsOnTask(taskId: string): Promise<WorkSessionRecord[]>;
  /** Every running session in the studio (used when tracking is switched off). */
  activeSessions(): Promise<WorkSessionRecord[]>;
  startSession(taskId: string, userId: string, at: Date): Promise<WorkSessionRecord>;
  endSession(sessionId: string, at: Date): Promise<void>;
  createPriorityConflict(input: {
    readonly raisedByUserId: string;
    readonly taskIds: readonly string[];
    readonly note: string;
  }): Promise<{ id: string }>;
  findPriorityConflictForUpdate(conflictId: string): Promise<PriorityConflictRecord | null>;
  resolvePriorityConflict(
    conflictId: string,
    resolution: { readonly at: Date; readonly byUserId: string; readonly note: string },
  ): Promise<void>;
}
