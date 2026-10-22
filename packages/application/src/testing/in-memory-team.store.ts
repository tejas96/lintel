import type { TeamDefinition } from '@lintel/domain';
import type { TeamChanges, TeamRecord, TeamStore } from '../teams/team.store';

/** TeamStore over an array, with the same version semantics as SQL. */
export class InMemoryTeamStore implements TeamStore {
  readonly teams: TeamRecord[] = [];
  /** Active members per team ID, set by the test. */
  readonly members = new Map<string, number>();
  private sequence = 0;

  async list() {
    return [...this.teams].sort((left, right) => left.name.localeCompare(right.name));
  }

  async find(teamId: string) {
    return this.teams.find((team) => team.id === teamId) ?? null;
  }

  async create(input: TeamDefinition) {
    this.sequence += 1;
    const created: TeamRecord = {
      ...input,
      id: `team-${this.sequence}`,
      archivedAt: null,
      version: 1,
    };
    this.teams.push(created);
    return created;
  }

  async update(teamId: string, expectedVersion: number, changes: TeamChanges) {
    const index = this.teams.findIndex((team) => team.id === teamId);
    const current = this.teams[index];
    if (!current || current.version !== expectedVersion) return null;
    const next = { ...current, ...changes, version: current.version + 1 };
    this.teams[index] = next;
    return next;
  }

  async activeMemberCount(teamId: string) {
    return this.members.get(teamId) ?? 0;
  }
}
