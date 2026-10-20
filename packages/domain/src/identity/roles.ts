/** Organisation-wide roles. Permissions come from capabilities, not role names. */
export const ROLES = [
  'owner',
  'administrator',
  'project_manager',
  'team_lead',
  'employee',
  'site_supervisor',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  owner: 'Owner',
  administrator: 'Administrator',
  project_manager: 'Project manager',
  team_lead: 'Team lead',
  employee: 'Employee',
  site_supervisor: 'Site supervisor',
};

/** Roles a person can hold inside a single project. */
export const PROJECT_ROLES = [
  'manager',
  'designer',
  'architect',
  'reviewer',
  'site_supervisor',
  'member',
] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_ROLE_LABELS: Readonly<Record<ProjectRole, string>> = {
  manager: 'Project manager',
  designer: 'Designer',
  architect: 'Architect',
  reviewer: 'Reviewer',
  site_supervisor: 'Site supervisor',
  member: 'Team member',
};
