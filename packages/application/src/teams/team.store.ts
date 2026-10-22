import type { TeamDefinition } from '@lintel/domain';

/** A team as its administrators see it, archived ones included. */
export interface TeamRecord extends TeamDefinition {
  readonly id: string;
  /** Set when the team was archived; it can no longer be chosen for anyone. */
  readonly archivedAt: Date | null;
  readonly version: number;
}

export type TeamChanges = Partial<TeamDefinition & { readonly archivedAt: Date | null }>;

/** Write side of team administration (`users.manage`). Teams are never deleted. */
export interface TeamStore {
  /** Every team, archived ones included. */
  list(): Promise<TeamRecord[]>;
  find(teamId: string): Promise<TeamRecord | null>;
  create(input: TeamDefinition): Promise<TeamRecord>;
  /** Applies the change only if `expectedVersion` still matches; null on a stale version. */
  update(teamId: string, expectedVersion: number, changes: TeamChanges): Promise<TeamRecord | null>;
  /** People on the team who can still sign in (invited or active). */
  activeMemberCount(teamId: string): Promise<number>;
}
