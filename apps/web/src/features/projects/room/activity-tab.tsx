'use client';

import type { ActivityItem } from '@lintel/api-contracts';
import {
  ActivityFeed,
  Button,
  EmptyState,
  ErrorState,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { useProjectActivity } from './use-project-room';

/** Everything that happened on the project, newest first, a page at a time. */
export function ActivityTab({ projectId }: { readonly projectId: string }) {
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<ActivityItem[]>([]);
  const activity = useProjectActivity(projectId, page);

  useEffect(() => {
    const items = activity.data?.items;
    if (!items || activity.isPlaceholderData) return;
    setEntries((current) => {
      const known = new Set(current.map((entry) => entry.id));
      return page === 1 ? items : [...current, ...items.filter((item) => !known.has(item.id))];
    });
  }, [activity.data, activity.isPlaceholderData, page]);

  if (activity.isPending)
    return (
      <SkeletonGroup label="Loading activity">
        <SkeletonText lines={8} />
      </SkeletonGroup>
    );
  if (activity.isError && entries.length === 0) {
    return (
      <ErrorState
        {...describeError(activity.error, { resource: 'collection' })}
        onRetry={() => activity.refetch()}
      />
    );
  }
  if (entries.length === 0)
    return (
      <EmptyState
        drawing="lamp"
        title="No activity yet"
        description="Status changes, reviews and comments on this project will be listed here."
      />
    );
  const hasMore = (activity.data?.totalPages ?? 1) > page;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <ActivityFeed
        timeZone={user.timeZone}
        entries={entries.map((entry) => ({
          id: entry.id,
          summary: entry.summary,
          createdAt: entry.createdAt,
          actor: entry.actor,
          context: entry.taskId ? (
            <Link
              href={`/tasks/${entry.taskId}`}
              className="rounded-sm text-ink-muted underline-offset-4 hover:underline"
            >
              Open task
            </Link>
          ) : undefined,
        }))}
      />
      {hasMore && (
        <Button
          variant="secondary"
          className="self-start"
          pending={activity.isFetching}
          onClick={() => setPage((current) => current + 1)}
        >
          Show older activity
        </Button>
      )}
    </div>
  );
}
