import type { WorkQueue, WorkQueueItem } from '@lintel/api-contracts';

export type Bucket = WorkQueueItem['bucket'];

/** The order the person last saw. The list keeps it until they accept a new one. */
export interface OrderSnapshot {
  readonly ids: readonly string[];
  readonly buckets: Readonly<Record<string, Bucket>>;
  readonly nextId: string | null;
}

export interface OrderChange {
  readonly item: WorkQueueItem;
  readonly kind: 'moved-up' | 'new' | 'changed-section' | 'new-first';
  readonly fromBucket?: Bucket;
}

export function snapshotOf(queue: WorkQueue): OrderSnapshot {
  const buckets: Record<string, Bucket> = {};
  for (const item of queue.items) buckets[item.task.id] = item.bucket;
  return {
    ids: queue.items.map((item) => item.task.id),
    buckets,
    nextId: queue.next?.task.id ?? null,
  };
}

/** Items in the snapshot's order (fresh content), with unseen items after them in server order. */
export function arrange(queue: WorkQueue, snapshot: OrderSnapshot): WorkQueueItem[] {
  const byId = new Map(queue.items.map((item) => [item.task.id, item]));
  const known = snapshot.ids
    .map((id) => byId.get(id))
    .filter((item): item is WorkQueueItem => item !== undefined)
    .map((item) => ({ ...item, bucket: snapshot.buckets[item.task.id] ?? item.bucket }));
  const seen = new Set(snapshot.ids);
  const unseen = queue.items.filter((item) => !seen.has(item.task.id));
  return [...known, ...unseen];
}

/** What would move if the person accepted the server's latest order. */
export function changesBetween(snapshot: OrderSnapshot, queue: WorkQueue): OrderChange[] {
  const previousRank = new Map(snapshot.ids.map((id, index) => [id, index]));
  const common = queue.items.filter((item) => previousRank.has(item.task.id));
  const changes: OrderChange[] = [];
  const newNext = queue.next?.task.id ?? null;
  if (newNext && newNext !== snapshot.nextId && queue.next) {
    changes.push({ item: queue.next, kind: 'new-first' });
  }
  for (const item of queue.items) {
    const id = item.task.id;
    if (id === newNext && newNext !== snapshot.nextId) continue;
    if (!previousRank.has(id)) {
      changes.push({ item, kind: 'new' });
      continue;
    }
    const before = snapshot.buckets[id];
    if (before && before !== item.bucket) {
      changes.push({ item, kind: 'changed-section', fromBucket: before });
      continue;
    }
    const nowRank = common.indexOf(item);
    const previous = common
      .map((candidate) => candidate.task.id)
      .sort((left, right) => (previousRank.get(left) ?? 0) - (previousRank.get(right) ?? 0))
      .indexOf(id);
    if (nowRank < previous) changes.push({ item, kind: 'moved-up' });
  }
  return changes;
}

export const BUCKET_ORDER: readonly Bucket[] = [
  'overdue',
  'today',
  'upcoming',
  'waiting',
  'blocked',
  'in_review',
  'later',
];

export const BUCKET_COPY: Readonly<Record<Bucket, { title: string; description: string }>> = {
  overdue: {
    title: 'Overdue',
    description: 'Past the due date. Start here, or say what is in the way.',
  },
  today: { title: 'Due today', description: 'Committed for today.' },
  upcoming: { title: 'Coming up', description: 'Due in the next few days.' },
  waiting: { title: 'Waiting', description: 'Can’t move until someone else finishes their part.' },
  blocked: { title: 'Blocked', description: 'You reported a blocker. Follow up or resolve it.' },
  in_review: {
    title: 'In review',
    description: 'Sent for review. Nothing to do unless changes come back.',
  },
  later: { title: 'Later', description: 'Planned further out.' },
};
