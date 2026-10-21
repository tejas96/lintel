import type { OutboxRecord } from '@lintel/application';
import { describe, expect, it } from 'vitest';
import { MalformedOutboxEventError, routeOutboxEvent, type WorkflowCommand } from './event-routing';

const occurredAt = new Date('2026-11-09T06:00:00.000Z');

function event(eventType: string, payload: Record<string, unknown>): OutboxRecord {
  return {
    id: 'e1',
    eventType,
    aggregateType: 'x',
    aggregateId: 'a1',
    payload,
    occurredAt,
    attempts: 0,
  };
}

function command(eventType: string, payload: Record<string, unknown>): WorkflowCommand {
  const route = routeOutboxEvent(event(eventType, payload));
  if (route.kind !== 'dispatch') throw new Error(`expected dispatch, got ${route.note}`);
  return route.command;
}

describe('outbox event routing', () => {
  it('signal-with-starts the deadline workflow for assignments and schedule changes', () => {
    for (const type of ['TaskAssigned', 'TaskScheduleChanged']) {
      const routed = command(type, { taskId: 't1', projectId: 'p1', dueDate: '2026-11-20' });
      expect(routed).toMatchObject({
        mode: 'signalWithStart',
        workflowType: 'taskDeadlineWorkflow',
        workflowId: 'task-deadline:t1',
        args: ['t1'],
        signal: 'scheduleChanged',
        subject: { subjectType: 'task', subjectId: 't1' },
      });
    }
    expect(command('TaskScheduleChanged', { taskId: 't1', dueDate: '2026-11-20' })).toMatchObject({
      signalArgs: [{ dueDate: '2026-11-20', reason: 'TaskScheduleChanged' }],
    });
  });

  it('only signals a running deadline workflow when the task completes', () => {
    expect(command('TaskCompleted', { taskId: 't1' })).toMatchObject({
      mode: 'signalIfRunning',
      workflowId: 'task-deadline:t1',
      signal: 'taskClosed',
    });
  });

  it('starts review follow-ups keyed by the submission round or deliverable version', () => {
    expect(command('TaskSubmittedForReview', { taskId: 't1', reviewerId: null })).toMatchObject({
      mode: 'start',
      workflowType: 'reviewFollowUpWorkflow',
      workflowId: 'review:task:t1:2026-11-09T06:00:00.000Z',
      args: [{ type: 'task', taskId: 't1', submittedAt: '2026-11-09T06:00:00.000Z' }],
    });
    expect(
      command('TaskSubmittedForReview', { taskId: 't1', submittedAt: '2026-11-09T05:59:59.000Z' })
        .workflowId,
    ).toBe('review:task:t1:2026-11-09T05:59:59.000Z');
    expect(command('DeliverableSubmitted', { deliverableId: 'd1', versionId: 'v1' })).toMatchObject(
      {
        mode: 'start',
        workflowId: 'review:deliverable:v1',
        args: [{ type: 'deliverable', versionId: 'v1' }],
        subject: { subjectType: 'deliverable_version', subjectId: 'v1' },
      },
    );
    expect(command('DeliverableReviewed', { versionId: 'v1', decision: 'approved' })).toMatchObject(
      { mode: 'signalIfRunning', workflowId: 'review:deliverable:v1', signal: 'reviewDecided' },
    );
  });

  it('starts blocker, leave and notification workflows with record-derived IDs', () => {
    expect(command('TaskBlocked', { taskId: 't1', blockerId: 'b1' })).toMatchObject({
      mode: 'start',
      workflowType: 'blockerFollowUpWorkflow',
      workflowId: 'blocker:b1',
    });
    expect(command('TaskUnblocked', { taskId: 't1', blockerId: 'b1' })).toMatchObject({
      mode: 'signalIfRunning',
      signal: 'blockerResolved',
    });
    expect(command('LeaveDecided', { leaveRequestId: 'l1', status: 'approved' })).toMatchObject({
      workflowType: 'leaveReassessmentWorkflow',
      workflowId: 'leave:l1',
    });
    expect(command('UrgentAbsenceRecorded', { leaveRequestId: 'l2' }).workflowId).toBe('leave:l2');
    expect(command('NotificationCreated', { notificationId: 'n1' })).toMatchObject({
      workflowType: 'notificationDeliveryWorkflow',
      workflowId: 'notification:n1',
      args: ['n1'],
    });
    expect(
      command('NotificationMessageQueued', { notificationId: 'n1', channel: 'sms' }),
    ).toMatchObject({
      mode: 'start',
      workflowType: 'messageDeliveryWorkflow',
      workflowId: 'notification:n1:sms',
      args: [{ notificationId: 'n1', channel: 'sms' }],
    });
    expect(
      command('NotificationMessageQueued', { notificationId: 'n1', channel: 'email' }).workflowId,
    ).toBe('notification:n1:email');
    expect(() =>
      routeOutboxEvent(
        event('NotificationMessageQueued', { notificationId: 'n1', channel: 'fax' }),
      ),
    ).toThrow(/channel/);
  });

  it('marks rejected leave and unknown event types as handled without a workflow', () => {
    const rejected = routeOutboxEvent(
      event('LeaveDecided', { leaveRequestId: 'l1', status: 'rejected' }),
    );
    expect(rejected).toEqual({ kind: 'ignore', note: expect.stringContaining('rejected') });
    const unknown = routeOutboxEvent(event('ProjectCreated', { projectId: 'p1' }));
    expect(unknown.kind).toBe('ignore');
    expect(routeOutboxEvent(event('SomethingNew', {})).kind).toBe('ignore');
  });

  it('rejects payloads without the identifiers it needs', () => {
    expect(() => routeOutboxEvent(event('TaskAssigned', { taskId: '' }))).toThrow(
      MalformedOutboxEventError,
    );
    expect(() => routeOutboxEvent(event('NotificationCreated', { notificationId: 42 }))).toThrow(
      /notificationId/,
    );
  });
});
