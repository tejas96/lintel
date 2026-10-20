import type { DomainEvent } from '@lintel/domain';

export interface ActivityEntry {
  readonly projectId: string | null;
  readonly taskId: string | null;
  readonly actorUserId: string | null;
  readonly type: string;
  readonly summary: string;
  readonly payload?: Record<string, unknown>;
}

export interface AuditEntry {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
  readonly requestId?: string | null;
}

/**
 * Activity feed, audit log and transactional outbox. Always used inside the
 * same transaction as the business change it describes.
 */
export interface RecordStore {
  appendActivity(entry: ActivityEntry): Promise<void>;
  appendAudit(entry: AuditEntry): Promise<void>;
  enqueueEvent(event: DomainEvent, availableAt?: Date): Promise<void>;
}
