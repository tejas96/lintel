export const PROJECT_STATUSES = [
  'draft',
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TYPES = [
  'residential_interior',
  'commercial_interior',
  'architecture',
  'interior_and_execution',
  'turnkey',
  'other',
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Readonly<Record<ProjectType, string>> = {
  residential_interior: 'Residential interiors',
  commercial_interior: 'Commercial interiors',
  architecture: 'Architecture',
  interior_and_execution: 'Interior design + execution',
  turnkey: 'Turnkey',
  other: 'Other',
};

export const PROJECT_CRITICALITIES = ['low', 'normal', 'high', 'critical'] as const;
export type ProjectCriticality = (typeof PROJECT_CRITICALITIES)[number];

export const PROJECT_STATUS_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> =
  {
    draft: ['active', 'cancelled'],
    active: ['on_hold', 'completed', 'cancelled'],
    on_hold: ['active', 'cancelled'],
    completed: ['active', 'archived'],
    cancelled: ['archived', 'draft'],
    archived: [],
  };

export function isLegalProjectTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_STATUS_TRANSITIONS[from].includes(to);
}
