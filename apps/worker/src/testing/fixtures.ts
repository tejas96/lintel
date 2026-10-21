import type {
  FollowUpProjectFacts,
  PushDeliveryFacts,
  TaskDeadlineFacts,
} from '@lintel/application';
import { definedOnly, type Patch, toCalendarDate } from '@lintel/shared';

export const OWNER = 'user-owner';
export const MANAGER = 'user-manager';
export const BUSINESS_OWNER = 'user-business-owner';
export const ADMIN = 'user-admin';

export const PROJECT: FollowUpProjectFacts = {
  id: 'project-1',
  name: 'Saska residence',
  reference: 'TST-001',
  status: 'active',
  criticality: 'normal',
  managerUserId: MANAGER,
};

export function deadlineTask(overrides: Patch<TaskDeadlineFacts> = {}): TaskDeadlineFacts {
  return {
    taskId: 'task-1',
    title: 'Working drawings',
    status: 'in_progress',
    priority: 'medium',
    dueDate: toCalendarDate('2026-11-10'),
    dueTime: null,
    escalateAfterOverdueDays: 1,
    ownerUserId: OWNER,
    ownerName: 'Ananya Joshi',
    archived: false,
    project: PROJECT,
    ...definedOnly(overrides),
  };
}

export function pushFacts(
  status: 'pending' | 'deferred' | 'sent' | 'skipped' | 'failed',
  overrides: { notBefore?: Date | null; providerMessageId?: string | null; attempts?: number } = {},
): PushDeliveryFacts {
  return {
    notificationId: 'notification-1',
    recipientUserId: OWNER,
    recipientActive: true,
    kind: 'task_overdue',
    title: 'Overdue: Working drawings',
    body: 'It was due yesterday.',
    linkPath: '/tasks/task-1',
    groupKey: 'task:task-1',
    delivery: {
      id: 'delivery-1',
      status,
      notBefore: overrides.notBefore ?? null,
      attempts: overrides.attempts ?? 0,
      providerMessageId: overrides.providerMessageId ?? null,
    },
  };
}
