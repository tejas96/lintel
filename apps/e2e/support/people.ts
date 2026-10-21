import { join } from 'node:path';

/** Seeded, obviously fictional people (packages/database/src/seed/seed-people.ts). */
export const PEOPLE = {
  owner: { nationalNumber: '9000000001', fullName: 'Aarav Mehta' },
  projectManager: { nationalNumber: '9000000003', fullName: 'Nisha Varma' },
  teamLead: { nationalNumber: '9000000005', fullName: 'Tara Kulkarni' },
  designer: { nationalNumber: '9000000006', fullName: 'Ananya Joshi' },
  siteSupervisor: { nationalNumber: '9000000010', fullName: 'Vikram Singh' },
} as const;

export type Role = keyof typeof PEOPLE;

/** Roles whose signed-in browser state the setup project saves for the journeys. */
export const SESSION_ROLES = ['owner', 'projectManager', 'teamLead', 'designer'] as const;
export type SessionRole = (typeof SESSION_ROLES)[number];

export function sessionFile(role: SessionRole): string {
  return join(__dirname, '../.auth', `${role}.json`);
}
