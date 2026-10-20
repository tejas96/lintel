'use client';

import type { WorkQueueItem } from '@lintel/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { arrange, changesBetween, type OrderSnapshot, snapshotOf } from './queue-order';

/**
 * The person's prioritised queue. The on-screen order only changes when the
 * person causes it or accepts it: background refreshes that would reorder
 * the list surface as an explained "priorities changed" notice instead.
 */
export function useWorkQueue() {
  const query = useQuery({
    queryKey: queryKeys.workQueue,
    queryFn: () => expectStatus(api.work.myWorkQueue(), 200),
    refetchInterval: (current) => (current.state.error ? false : 2 * 60_000),
  });
  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(null);
  const acceptNextOrder = useRef(false);
  const data = query.data;

  useEffect(() => {
    if (!data) return;
    const accept = acceptNextOrder.current;
    acceptNextOrder.current = false;
    setSnapshot((previous) =>
      !previous || accept || changesBetween(previous, data).length === 0
        ? snapshotOf(data)
        : previous,
    );
  }, [data]);

  const view = useMemo(() => {
    if (!data || !snapshot) return null;
    const items = arrange(data, snapshot);
    const pinnedNext = snapshot.nextId
      ? items.find((item) => item.task.id === snapshot.nextId)
      : undefined;
    const next: WorkQueueItem | null = pinnedNext ?? data.next;
    return {
      queue: data,
      next,
      items: items.filter((item) => item.task.id !== next?.task.id),
      changes: changesBetween(snapshot, data),
    };
  }, [data, snapshot]);

  const applyLatestOrder = useCallback(() => {
    if (data) setSnapshot(snapshotOf(data));
  }, [data]);

  /** Call before your own change so the resulting reorder is shown, not held back. */
  const expectReorder = useCallback(() => {
    acceptNextOrder.current = true;
  }, []);

  return { query, view, applyLatestOrder, expectReorder };
}
