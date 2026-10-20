import { domainEvent, notificationDedupeKey } from '@lintel/domain';
import type { RecordStore } from '../common/record.store';
import type { Notifier } from '../notifications/notifier';

export interface AssignedTask {
  readonly taskId: string;
  readonly ownerUserId: string;
}

export interface AssignmentAnnouncement {
  readonly actorUserId: string;
  readonly project: { readonly id: string; readonly name: string };
  readonly assigned: readonly AssignedTask[];
}

/**
 * Emits `TaskAssigned` for every assigned task and sends each assignee one
 * summary notification per project, so a 40-task plan is not 40 pings.
 * People are not notified about work they assigned to themselves.
 */
export async function announceNewAssignments(
  records: RecordStore,
  notifier: Notifier,
  announcement: AssignmentAnnouncement,
): Promise<void> {
  const { project, actorUserId } = announcement;
  const perOwner = new Map<string, number>();
  for (const task of announcement.assigned) {
    await records.enqueueEvent(
      domainEvent('TaskAssigned', 'task', task.taskId, {
        taskId: task.taskId,
        projectId: project.id,
        ownerId: task.ownerUserId,
        assignedBy: actorUserId,
      }),
    );
    perOwner.set(task.ownerUserId, (perOwner.get(task.ownerUserId) ?? 0) + 1);
  }
  for (const [userId, count] of perOwner) {
    if (userId === actorUserId) continue;
    await notifier.notify({
      recipientUserId: userId,
      kind: 'task_assigned',
      title: `New work in ${project.name}`,
      body: `You have ${count} new ${count === 1 ? 'task' : 'tasks'} in ${project.name}.`,
      linkPath: `/projects/${project.id}`,
      subjectType: 'project',
      subjectId: project.id,
      dedupeKey: notificationDedupeKey({
        kind: 'task_assigned',
        recipientId: userId,
        subjectId: project.id,
      }),
    });
  }
}
