import type { LeaveTypeDefinition } from '@lintel/domain';

/** A leave type as its administrators see it, retired ones included. */
export interface LeaveTypeAdminRecord extends LeaveTypeDefinition {
  readonly id: string;
  readonly code: string;
  readonly isActive: boolean;
  readonly version: number;
}

export type LeaveTypeChanges = Partial<LeaveTypeDefinition & { readonly isActive: boolean }>;

/** Write side of leave type administration (`leave.manage_policies`). */
export interface LeaveTypeStore {
  /** Every type, active first, then by name. */
  list(): Promise<LeaveTypeAdminRecord[]>;
  find(leaveTypeId: string): Promise<LeaveTypeAdminRecord | null>;
  create(input: LeaveTypeDefinition & { readonly code: string }): Promise<LeaveTypeAdminRecord>;
  /** Applies the change only if `expectedVersion` still matches; null on a stale version. */
  update(
    leaveTypeId: string,
    expectedVersion: number,
    changes: LeaveTypeChanges,
  ): Promise<LeaveTypeAdminRecord | null>;
}
