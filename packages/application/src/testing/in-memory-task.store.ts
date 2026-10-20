import type { TaskRecord, TaskStore } from '../tasks/task.store';
import type { InMemoryOperationsWorld } from './in-memory-operations.world';

const unused = (name: string) => () => {
  throw new Error(`${name} is not used by these tests.`);
};

/** TaskStore over the in-memory world, with the same version semantics as SQL. */
export function buildTaskStore(world: InMemoryOperationsWorld): TaskStore {
  const find = async (taskId: string) => world.tasks.get(taskId) ?? null;
  return {
    find,
    findForUpdate: find,
    async decisionInputs(taskId) {
      const prerequisiteEdges = world.edges.filter((edge) => edge.taskId === taskId);
      return {
        collaboratorUserIds: world.collaborators.get(taskId) ?? [],
        prerequisiteEdges,
        prerequisites: prerequisiteEdges
          .map((edge) => world.tasks.get(edge.dependsOnTaskId))
          .filter((task): task is TaskRecord => Boolean(task))
          .map((task) => ({ id: task.id, title: task.title, status: task.status })),
        checklist: world.checklist
          .filter((item) => item.taskId === taskId)
          .map((item) => ({ isRequired: item.isRequired, completed: item.completedAt !== null })),
        deliverables: world.deliverables
          .filter((item) => item.taskId === taskId)
          .map((item) => ({
            name: item.name,
            isRequired: item.isRequired,
            status: item.status,
            currentVersionNumber: item.currentVersionNumber,
          })),
        openBlockerCount: world.blockers.filter(
          (item) => item.taskId === taskId && !item.resolvedAt,
        ).length,
      };
    },
    create: unused('create'),
    async update(taskId, expectedVersion, changes) {
      const task = world.tasks.get(taskId);
      if (!task || task.version !== expectedVersion) return null;
      const next = { ...task, ...changes, version: task.version + 1 };
      world.tasks.set(taskId, next);
      return next;
    },
    async addActualMinutes(taskId, minutes) {
      const task = world.tasks.get(taskId);
      if (task) world.tasks.set(taskId, { ...task, actualMinutes: task.actualMinutes + minutes });
    },
    async collaboratorIds(taskId) {
      return world.collaborators.get(taskId) ?? [];
    },
    async replaceCollaborators(taskId, userIds) {
      world.collaborators.set(taskId, [...userIds]);
    },
    async lockProject() {},
    async dependencyGraph(projectId) {
      const nodes = [...world.tasks.values()]
        .filter((task) => task.projectId === projectId)
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          ownerUserId: task.ownerUserId,
        }));
      const ids = new Set(nodes.map((node) => node.id));
      return { edges: world.edges.filter((edge) => ids.has(edge.taskId)), nodes };
    },
    addDependency: unused('addDependency'),
    removeDependency: unused('removeDependency'),
    recordScheduleChange: unused('recordScheduleChange'),
    attachFile: unused('attachFile'),
    async referencesInProject(projectId, references) {
      const task = references.taskId ? world.tasks.get(references.taskId) : undefined;
      return { stage: true, milestone: true, task: task?.projectId === projectId };
    },
    async activeUserIds(userIds) {
      return new Set(userIds.filter((id) => world.activeUsers.has(id)));
    },
    async ensureProjectMember(projectId, userId) {
      const project = world.projects.get(projectId);
      if (!project || project.members.has(userId)) return false;
      project.members.set(userId, 'member');
      return true;
    },
  };
}
