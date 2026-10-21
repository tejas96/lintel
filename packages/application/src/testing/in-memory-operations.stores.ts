import type { ProjectAccessStore } from '../access/project-access.store';
import type { RecordStore } from '../common/record.store';
import type { DeliverableStore } from '../deliverables/deliverable.store';
import type { NotificationStore } from '../notifications/notification.store';
import type { OperationsStores } from '../tasks/operations-context';
import type { TaskItemStore } from '../tasks/task-item.store';
import type { WorkSessionStore } from '../work/work-session.store';
import { buildDeliverableStore } from './in-memory-deliverable.store';
import type { InMemoryOperationsWorld } from './in-memory-operations.world';
import { buildTaskStore } from './in-memory-task.store';

const unused = (name: string) => () => {
  throw new Error(`${name} is not used by these tests.`);
};

function accessStore(world: InMemoryOperationsWorld): ProjectAccessStore {
  return {
    async accessFacts(projectId, userId) {
      const project = world.projects.get(projectId);
      if (!project) {
        return {
          projectId,
          exists: false,
          projectRole: null,
          managerUserId: null,
          ownerUserId: null,
        };
      }
      return {
        projectId,
        exists: true,
        projectRole: project.members.get(userId) ?? null,
        managerUserId: project.managerUserId,
        ownerUserId: project.ownerUserId,
      };
    },
    async memberProjectIds(userId) {
      return [...world.projects.entries()]
        .filter(([, project]) => project.members.has(userId))
        .map(([id]) => id);
    },
    async projectIdOfTask(taskId) {
      return world.tasks.get(taskId)?.projectId ?? null;
    },
    async projectIdOfDeliverable(deliverableId) {
      return world.deliverables.find((item) => item.id === deliverableId)?.projectId ?? null;
    },
    projectIdOfMilestone: unused('projectIdOfMilestone'),
  };
}

function recordStore(world: InMemoryOperationsWorld): RecordStore {
  return {
    async appendActivity(entry) {
      world.activity.push(entry);
    },
    async appendAudit(entry) {
      world.audit.push(entry);
    },
    async enqueueEvent(event) {
      world.events.push(event);
    },
  };
}

function notificationStore(world: InMemoryOperationsWorld): NotificationStore {
  return {
    async recipientContext(userId) {
      if (!world.activeUsers.has(userId)) return null;
      return {
        userId,
        quietHoursStart: null,
        quietHoursEnd: null,
        hasActiveDevice: false,
        preferences: [],
      };
    },
    async create(notification) {
      const duplicate = world.notifications.some(
        (existing) =>
          existing.recipientUserId === notification.recipientUserId &&
          existing.dedupeKey === notification.dedupeKey,
      );
      if (duplicate) return null;
      world.notifications.push(notification);
      return { id: world.nextId('notification') };
    },
  };
}

function taskItemStore(world: InMemoryOperationsWorld): TaskItemStore {
  return {
    addChecklistItems: unused('addChecklistItems'),
    findChecklistItem: unused('findChecklistItem'),
    setChecklistItemCompletion: unused('setChecklistItemCompletion'),
    removeChecklistItem: unused('removeChecklistItem'),
    async createBlocker(blocker) {
      const record = {
        ...blocker,
        id: world.nextId('blocker'),
        raisedAt: world.clock.now(),
        resolvedAt: null,
      };
      world.blockers.push(record);
      return record;
    },
    async findBlockerForUpdate(blockerId) {
      return world.blockers.find((item) => item.id === blockerId) ?? null;
    },
    async resolveBlocker(blockerId, resolution) {
      const index = world.blockers.findIndex((item) => item.id === blockerId);
      const blocker = world.blockers[index];
      if (blocker && !blocker.resolvedAt) {
        world.blockers[index] = { ...blocker, resolvedAt: resolution.at };
      }
    },
    async openBlockerCount(taskId) {
      return world.blockers.filter((item) => item.taskId === taskId && !item.resolvedAt).length;
    },
    addComment: unused('addComment'),
  };
}

function workSessionStore(world: InMemoryOperationsWorld): WorkSessionStore {
  const replace = (id: string, endedAt: Date) => {
    const index = world.sessions.findIndex((session) => session.id === id);
    const session = world.sessions[index];
    if (session && !session.endedAt) world.sessions[index] = { ...session, endedAt };
  };
  return {
    async lockPerson() {},
    async activeSessionFor(userId) {
      return world.sessions.find((item) => item.userId === userId && !item.endedAt) ?? null;
    },
    async activeSessionsOnTask(taskId) {
      return world.sessions.filter((item) => item.taskId === taskId && !item.endedAt);
    },
    async activeSessions() {
      return world.sessions.filter((item) => !item.endedAt);
    },
    async startSession(taskId, userId, at) {
      const session = { id: world.nextId('session'), taskId, userId, startedAt: at, endedAt: null };
      world.sessions.push(session);
      return session;
    },
    async endSession(sessionId, at) {
      replace(sessionId, at);
    },
    createPriorityConflict: unused('createPriorityConflict'),
    findPriorityConflictForUpdate: unused('findPriorityConflictForUpdate'),
    resolvePriorityConflict: unused('resolvePriorityConflict'),
  };
}

export function buildOperationsStores(world: InMemoryOperationsWorld): OperationsStores {
  const deliverables: DeliverableStore = buildDeliverableStore(world);
  return {
    access: accessStore(world),
    tasks: buildTaskStore(world),
    taskItems: taskItemStore(world),
    workSessions: workSessionStore(world),
    deliverables,
    records: recordStore(world),
    notifications: notificationStore(world),
  };
}
