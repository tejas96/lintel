'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import {
  Avatar,
  EmptyState,
  ErrorState,
  Input,
  PriorityMarker,
  ResponsiveTable,
  SegmentedControl,
  SkeletonGroup,
  SkeletonText,
  type TableColumn,
} from '@lintel/design-system/web';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { TaskNumber, TaskStatusPill } from '@/features/tasks/task-presentation';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { describeTaskDue } from '@/lib/format/task-due';
import { useProjectTasks } from './use-project-room';

type Scope = 'open' | 'all' | 'done';
const CLOSED = new Set(['done', 'cancelled']);

/** Every task in a sortable, searchable table (cards on phones). */
export function ListTab({ projectId }: { readonly projectId: string }) {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const tasks = useProjectTasks(projectId);
  const [scope, setScope] = useState<Scope>('open');
  const [search, setSearch] = useState('');
  if (tasks.isPending)
    return (
      <SkeletonGroup label="Loading tasks">
        <SkeletonText lines={8} />
      </SkeletonGroup>
    );
  if (tasks.isError)
    return (
      <ErrorState
        {...describeError(tasks.error, { resource: 'collection' })}
        onRetry={() => tasks.refetch()}
      />
    );
  const needle = search.trim().toLowerCase();
  const rows = tasks.data.items.filter((task) => {
    if (scope === 'open' && CLOSED.has(task.status)) return false;
    if (scope === 'done' && task.status !== 'done') return false;
    return (
      !needle ||
      `${task.title} ${task.number} ${task.owner?.fullName ?? ''}`.toLowerCase().includes(needle)
    );
  });
  const columns: TableColumn<TaskSummary>[] = [
    {
      key: 'task',
      header: 'Task',
      primary: true,
      cell: (task) => (
        <span className="flex min-w-0 items-center gap-2">
          <TaskNumber value={task.number} />
          <Link
            href={`/tasks/${task.id}`}
            className="lt-stretched-link truncate rounded-sm font-medium text-ink"
          >
            {task.title}
          </Link>
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (task) => <TaskStatusPill status={task.status} /> },
    {
      key: 'stage',
      header: 'Stage',
      hideOnPhone: true,
      cell: (task) => <span className="text-ink-muted">{task.stage?.name ?? 'None'}</span>,
    },
    {
      key: 'owner',
      header: 'Owner',
      cell: (task) =>
        task.owner ? (
          <span className="flex items-center gap-2 text-ink-muted">
            <Avatar name={task.owner.fullName} hue={task.owner.avatarHue} size="xs" decorative />
            {task.owner.fullName}
          </span>
        ) : (
          <span className="text-ink-faint">Unassigned</span>
        ),
    },
    {
      key: 'priority',
      header: 'Priority',
      hideOnPhone: true,
      cell: (task) => <PriorityMarker priority={task.priority} />,
    },
    {
      key: 'due',
      header: 'Due',
      align: 'end',
      cell: (task) => {
        const due = describeTaskDue(task, today);
        if (!due) return <span className="text-ink-faint">No date</span>;
        return (
          <span
            className={
              due.late && !CLOSED.has(task.status) ? 'font-medium text-overdue' : 'text-ink-muted'
            }
          >
            {due.text}
          </span>
        );
      },
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-80">
          <Input
            type="search"
            aria-label="Search tasks"
            placeholder="Search tasks or people"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leading={<Search aria-hidden />}
          />
        </div>
        <SegmentedControl
          label="Which tasks"
          value={scope}
          onValueChange={setScope}
          size="sm"
          options={[
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          size="section"
          drawing="plan"
          title="No tasks match"
          description="Try another search or show all tasks."
        />
      ) : (
        <ResponsiveTable
          caption="Project tasks"
          columns={columns}
          rows={rows}
          rowKey={(task) => task.id}
        />
      )}
    </div>
  );
}
