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
  projectProfitability: (projectId: string) =>
    ['projects', 'detail', projectId, 'profitability'] as const,
  report: (name: string, query: Record<string, unknown>) => ['reports', name, query] as const,
  allReports: ['reports'] as const,
  allCommandCenters: ['dashboard', 'command-center'] as const,
  projectDocuments: (projectId: string, filters: Record<string, unknown>) =>
    ['projects', 'detail', projectId, 'documents', filters] as const,
  allProjectDocuments: (projectId: string) =>
    ['projects', 'detail', projectId, 'documents'] as const,
  document: (documentId: string) => ['documents', documentId] as const,
  taskReassignments: (taskId: string) => ['tasks', 'detail', taskId, 'reassignments'] as const,
  taskDateChanges: (taskId: string) => ['tasks', 'detail', taskId, 'date-changes'] as const,
  briefing: (query: Record<string, unknown>) => ['dashboard', 'briefing', query] as const,
  allBriefings: ['dashboard', 'briefing'] as const,
  projectRisks: (projectId: string) => ['projects', 'detail', projectId, 'risks'] as const,
  coverSuggestions: (leaveId: string) => ['leave', leaveId, 'cover-suggestions'] as const,
  templateUpdate: (projectId: string) =>
    ['projects', 'detail', projectId, 'template-update'] as const,
  templateUpdatePreview: (projectId: string, versionId: string, ticked: readonly string[]) =>
    ['projects', 'detail', projectId, 'template-update', 'preview', versionId, ticked] as const,
};
