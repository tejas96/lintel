import type { LeaveTypeAdminRecord, LeaveTypeStore } from '../leave-policies/leave-type.store';

/** LeaveTypeStore over an array, with the same version semantics as SQL. */
export class InMemoryLeaveTypeStore implements LeaveTypeStore {
  readonly types: LeaveTypeAdminRecord[] = [];
  private sequence = 0;

  async list() {
    return [...this.types].sort(
      (left, right) =>
        Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name),
    );
  }

  async find(leaveTypeId: string) {
    return this.types.find((type) => type.id === leaveTypeId) ?? null;
  }

  async create(input: Parameters<LeaveTypeStore['create']>[0]) {
    this.sequence += 1;
    const created: LeaveTypeAdminRecord = {
      ...input,
      id: `type-${this.sequence}`,
      isActive: true,
      version: 1,
    };
    this.types.push(created);
    return created;
  }

  async update(
    leaveTypeId: string,
    expectedVersion: number,
    changes: Parameters<LeaveTypeStore['update']>[2],
  ) {
    const index = this.types.findIndex((type) => type.id === leaveTypeId);
    const current = this.types[index];
    if (!current || current.version !== expectedVersion) return null;
    const next = { ...current, ...changes, version: current.version + 1 };
    this.types[index] = next;
    return next;
  }
}
