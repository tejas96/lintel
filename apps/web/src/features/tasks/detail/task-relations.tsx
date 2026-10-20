'use client';

import type { Blocker, TaskDetail, TaskRef } from '@lintel/api-contracts';
import { Avatar, Button, Dialog, Field, Switch, Textarea } from '@lintel/design-system/web';
import Link from 'next/link';
import { useState } from 'react';
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';
import { TaskNumber, TaskStatusPill } from '../task-presentation';
import { useTaskActions } from '../use-task-actions';
import { DetailSection } from './detail-section';

function RefList({
  tasks,
  today,
  empty,
}: {
  readonly tasks: readonly TaskRef[];
  readonly today: string;
  readonly empty: string;
}) {
  if (tasks.length === 0) return <p className="type-body-sm text-ink-faint">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {tasks.map((ref) => (
        <li
          key={ref.id}
          className="relative flex items-center gap-2 rounded-md px-2 py-2 hover:bg-sunken/60"
        >
          <TaskNumber value={ref.number} />
          <Link
            href={`/tasks/${ref.id}`}
            className="lt-stretched-link min-w-0 flex-1 truncate rounded-sm type-body-sm text-ink"
          >
            {ref.title}
          </Link>
          {ref.dueDate && (
            <span className="type-body-sm text-ink-faint">
              {formatCalendarDate(ref.dueDate, today)}
            </span>
          )}
          <TaskStatusPill status={ref.status} />
        </li>
      ))}
    </ul>
  );
}

/** What this task waits on, and what waits on it. */
export function TaskDependencies({
  task,
  today,
}: {
  readonly task: TaskDetail;
  readonly today: string;
}) {
  if (task.prerequisites.length === 0 && task.dependents.length === 0) return null;
  return (
    <DetailSection title="Dependencies">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="type-label text-ink-muted">Waiting on</h3>
          <RefList
            tasks={task.prerequisites}
            today={today}
            empty="Nothing. This can start any time."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="type-label text-ink-muted">Unblocks</h3>
          <RefList
            tasks={task.dependents}
            today={today}
            empty="No other task waits for this one."
          />
        </div>
      </div>
    </DetailSection>
  );
}

const CATEGORY_LABELS: Readonly<Record<Blocker['category'], string>> = {
  client: 'Client',
  supplier: 'Supplier',
  internal_dependency: 'Another task',
  manager_decision: 'Manager decision',
  information: 'Missing information',
  other: 'Other',
};

/** Open blockers with a way to resolve them, and the resolved ones as history. */
export function TaskBlockers({
  task,
  onReport,
}: {
  readonly task: TaskDetail;
  readonly onReport: () => void;
}) {
  const [resolving, setResolving] = useState<Blocker | null>(null);
  const [resolution, setResolution] = useState('');
  const [resume, setResume] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolveBlocker } = useTaskActions();
  const open = task.blockers.filter((blocker) => blocker.resolvedAt === null);
  const resolved = task.blockers.filter((blocker) => blocker.resolvedAt !== null);
  if (task.blockers.length === 0) return null;
  return (
    <DetailSection title="Blockers" meta={open.length > 0 ? `${open.length} open` : 'All resolved'}>
      <ul className="flex flex-col gap-2">
        {[...open, ...resolved].map((blocker) => (
          <li
            key={blocker.id}
            className={
              blocker.resolvedAt
                ? 'rounded-md border border-hairline p-3 opacity-75'
                : 'rounded-md border border-blocked/30 bg-blocked-tint/50 p-3'
            }
          >
            <p className="flex flex-wrap items-center gap-x-2 type-body-sm">
              <span className="font-medium text-ink">{CATEGORY_LABELS[blocker.category]}</span>
              <span className="text-ink-faint">
                {blocker.resolvedAt
                  ? 'resolved'
                  : `raised ${formatRelativeInstant(blocker.raisedAt)}`}
              </span>
            </p>
            <p className="mt-1 type-body-sm text-ink">{blocker.reason}</p>
            {blocker.waitingOn && (
              <p className="mt-2 flex items-center gap-2 type-body-sm text-ink-muted">
                <Avatar
                  name={blocker.waitingOn.fullName}
                  hue={blocker.waitingOn.avatarHue}
                  size="xs"
                  decorative
                />
                Waiting on {blocker.waitingOn.fullName}
              </p>
            )}
            {blocker.resolution && (
              <p className="mt-2 type-body-sm text-ink-muted">Resolution: {blocker.resolution}</p>
            )}
            {!blocker.resolvedAt && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => setResolving(blocker)}
              >
                Mark resolved
              </Button>
            )}
          </li>
        ))}
      </ul>
      {open.length === 0 && task.status !== 'done' && (
        <Button size="sm" variant="quiet" className="self-start" onClick={onReport}>
          Report another blocker
        </Button>
      )}
      <Dialog
        open={resolving !== null}
        onOpenChange={(next) => {
          if (!next) setResolving(null);
        }}
        title="Resolve blocker"
        description={resolving?.reason}
        footer={
          <>
            <Button variant="quiet" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              pending={resolveBlocker.isPending}
              onClick={() => {
                if (!resolving) return;
                if (resolution.trim().length < 3) {
                  setError('Say how it was resolved.');
                  return;
                }
                resolveBlocker.mutate(
                  { blockerId: resolving.id, resolution: resolution.trim(), resumeWork: resume },
                  {
                    onSuccess: () => {
                      setResolving(null);
                      setResolution('');
                      setError(null);
                    },
                  },
                );
              }}
            >
              Mark resolved
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="How was it resolved?" error={error} required>
            <Textarea
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              rows={3}
            />
          </Field>
          <Switch
            label="Carry on with the work"
            description="Moves the task back to in progress."
            checked={resume}
            onCheckedChange={setResume}
          />
        </div>
      </Dialog>
    </DetailSection>
  );
}
