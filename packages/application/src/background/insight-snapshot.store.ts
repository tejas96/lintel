import type { CalendarDate } from '@lintel/shared';

/** Daily business health readings (the score's trend on the command center). */
export interface InsightSnapshotStore {
  /**
   * Computes today's business health for the whole studio and for each
   * project manager's live projects, and records one reading per scope and
   * day (a rerun the same day replaces the reading).
   */
  recordBusinessHealth(today: CalendarDate, now: Date): Promise<{ readonly recorded: number }>;
}
