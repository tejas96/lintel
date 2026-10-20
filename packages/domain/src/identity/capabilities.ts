import type { Role } from './roles';

/**
 * Explicit capabilities checked by the backend. Roles map to capabilities by
 * default; administrators can change the mapping in settings.
 */
export const CAPABILITIES = [
  'organization.manage_settings',
  'users.view_directory',
  'users.manage',
  'roles.manage',
  'projects.create',
  'projects.view_all',
  'projects.manage_any',
  'templates.manage',
  'tasks.assign',
  'tasks.manage_any',
  'deliverables.review',
  'scope_changes.approve',
  'leave.request',
  'leave.approve_team',
  'leave.approve_any',
  'leave.record_absence',
  'leave.manage_policies',
  'capacity.view_team',
  'capacity.view_all',
  'rewards.view_own',
  'rewards.view_all',
  'rewards.manage_policies',
  'rewards.decide',
  'dashboard.view_business',
  'audit.view',
  'files.view_confidential',
  'site_updates.create',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const EVERYONE: readonly Capability[] = [
  'users.view_directory',
  'leave.request',
  'rewards.view_own',
];

const ADMINISTRATOR: readonly Capability[] = CAPABILITIES.filter(
  // Compensation decisions stay with the owner unless the owner delegates them.
  (capability) => capability !== 'rewards.view_all' && capability !== 'rewards.decide',
);

export const DEFAULT_ROLE_CAPABILITIES: Readonly<Record<Role, readonly Capability[]>> = {
  owner: CAPABILITIES,
  administrator: ADMINISTRATOR,
  project_manager: [
    ...EVERYONE,
    'projects.create',
    'templates.manage',
    'tasks.assign',
    'deliverables.review',
    'leave.approve_team',
    'leave.record_absence',
    'capacity.view_team',
    'site_updates.create',
  ],
  team_lead: [
    ...EVERYONE,
    'tasks.assign',
    'deliverables.review',
    'leave.approve_team',
    'capacity.view_team',
  ],
  employee: [...EVERYONE],
  site_supervisor: [...EVERYONE, 'site_updates.create'],
};

export function hasCapability(granted: ReadonlySet<Capability>, required: Capability): boolean {
  return granted.has(required);
}
