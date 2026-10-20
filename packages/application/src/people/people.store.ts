import type { Role } from '@lintel/domain';
import type { Patch } from '@lintel/shared';

export interface PersonInput {
  readonly fullName: string;
  readonly phoneE164: string;
  readonly email: string | null;
  readonly designation: string | null;
  readonly role: Role;
  readonly teamId: string | null;
  readonly reportsToUserId: string | null;
  readonly capacityPercent: number;
}

export interface PersonRecord extends PersonInput {
  readonly id: string;
  readonly status: 'invited' | 'active' | 'deactivated';
  readonly version: number;
}

/** Write-side persistence for people and teams. */
export interface PeopleStore {
  findById(userId: string): Promise<PersonRecord | null>;
  phoneInUse(phoneE164: string, exceptUserId: string | null): Promise<boolean>;
  teamExists(teamId: string): Promise<boolean>;
  create(input: PersonInput): Promise<PersonRecord>;
  /** Applies the change only if `expectedVersion` still matches. Returns null on a stale version. */
  update(
    userId: string,
    expectedVersion: number,
    changes: Patch<PersonInput>,
  ): Promise<PersonRecord | null>;
  setStatus(
    userId: string,
    expectedVersion: number,
    status: 'active' | 'deactivated',
    at: Date,
  ): Promise<PersonRecord | null>;
  createTeam(name: string, description: string | null): Promise<{ id: string }>;
  teamNameInUse(name: string): Promise<boolean>;
}
