import type { ActivityEntry, AuditEntry, RecordStore } from '@lintel/application';
import type { DomainEvent } from '@lintel/domain';
import type { DatabaseExecutor } from '../client';
import { activityEvents, auditLog, outboxEvents } from '../schema';

export class RecordRepository implements RecordStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async appendActivity(entry: ActivityEntry) {
    await this.db.insert(activityEvents).values({
      projectId: entry.projectId,
      taskId: entry.taskId,
      actorUserId: entry.actorUserId,
      type: entry.type,
      summary: entry.summary,
      payload: entry.payload ?? {},
    });
  }

  async appendAudit(entry: AuditEntry) {
    await this.db.insert(auditLog).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before ?? null,
      after: entry.after ?? null,
      requestId: entry.requestId ?? null,
    });
  }

  async enqueueEvent(event: DomainEvent, availableAt?: Date) {
    await this.db.insert(outboxEvents).values({
      eventType: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: { ...event.payload },
      ...(availableAt ? { availableAt } : {}),
    });
  }
}
