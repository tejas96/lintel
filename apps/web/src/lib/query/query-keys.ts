/** Every React Query key in one place, so invalidation stays consistent. */
export const queryKeys = {
  workQueue: ['work-queue'] as const,
  approvals: ['approvals', 'mine'] as const,
  task: (taskId: string) => ['tasks', 'detail', taskId] as const,
  taskComments: (taskId: string) => ['tasks', 'detail', taskId, 'comments'] as const,
  taskList: (filters: Record<string, unknown>) => ['tasks', 'list', filters] as const,
  allTaskLists: ['tasks', 'list'] as const,
  openBlockers: (projectId: string | undefined) => ['blockers', projectId ?? 'all'] as const,
  projectList: (filters: Record<string, unknown>) => ['projects', 'list', filters] as const,
  allProjectLists: ['projects', 'list'] as const,
  project: (projectId: string) => ['projects', 'detail', projectId] as const,
  projectActivity: (projectId: string, page: number) =>
    ['projects', 'detail', projectId, 'activity', page] as const,
  projectDeliverables: (projectId: string) =>
    ['projects', 'detail', projectId, 'deliverables'] as const,
  scopeChanges: (projectId: string) => ['projects', 'detail', projectId, 'scope-changes'] as const,
  deliverable: (deliverableId: string) => ['deliverables', deliverableId] as const,
  templates: (projectType: string | undefined) => ['templates', projectType ?? 'all'] as const,
  template: (templateId: string) => ['templates', 'detail', templateId] as const,
  people: (filters: Record<string, unknown>) => ['people', 'list', filters] as const,
  allPeople: ['people'] as const,
  teams: ['teams'] as const,
  organization: ['settings', 'organization'] as const,
  roles: ['settings', 'roles'] as const,
  holidays: ['settings', 'holidays'] as const,
};
