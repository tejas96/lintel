import type { DayPortion, Role, TaskStatus } from '@lintel/domain';

/** A person as lists show them (matches the API's user summary). */
export interface PersonSummary {
  readonly id: string;
  readonly fullName: string;
  readonly designation: string | null;
  readonly role: Role;
  readonly avatarHue: number;
  readonly status: 'invited' | 'active' | 'deactivated';
}

export interface CapacityPersonRecord {
  readonly user: PersonSummary;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly capacityPercent: number;
}

export interface CapacityLeaveRecord {
  readonly userId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dayPortion: DayPortion;
  readonly status: 'approved' | 'pending' | 'info_requested';
}

export interface CapacityTaskRecord {
  readonly taskId: string;
  readonly ownerUserId: string;
  readonly status: TaskStatus;
  readonly estimateMinutes: number | null;
  readonly actualMinutes: number;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly hasOpenBlocker: boolean;
}

/** Read-only facts for workload and availability. */
export interface CapacityReadStore {
  /** Active people; `userIds: null` means everyone. `teamId` narrows the list. */
  people(query: {
    readonly userIds: readonly string[] | null;
    readonly teamId: string | null;
  }): Promise<CapacityPersonRecord[]>;
  teamMemberIds(teamId: string): Promise<string[]>;
  directReportIds(userId: string): Promise<string[]>;
  /** Pending, info-requested and approved leave touching the range. */
  leaveInRange(
    userIds: readonly string[],
    start: string,
    end: string,
  ): Promise<CapacityLeaveRecord[]>;
  /** Open, non-archived tasks owned by the people. */
  openTaskLoads(userIds: readonly string[]): Promise<CapacityTaskRecord[]>;
}
