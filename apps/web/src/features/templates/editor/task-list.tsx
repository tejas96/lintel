'use client';

import { Button, IconButton, PriorityMarker, StatusGlyph } from '@lintel/design-system/web';
import { pluralize } from '@lintel/shared';
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react';
import { type TemplateIssue, taskIssues } from '../template-issues';
import { roleLabel, type TemplateStage } from '../template-types';

interface TaskListProps {
  readonly stage: TemplateStage;
  readonly issues: readonly TemplateIssue[];
  readonly readOnly: boolean;
  readonly onOpen: (taskIndex: number) => void;
  readonly onMove: (taskIndex: number, direction: -1 | 1) => void;
  readonly onAdd: () => void;
}

/** The stage's tasks in order; each opens in the task editor. */
export function TaskList({ stage, issues, readOnly, onOpen, onMove, onAdd }: TaskListProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title-md text-ink">Tasks</h3>
        {!readOnly && (
          <Button size="sm" variant="quiet" leadingIcon={<Plus aria-hidden />} onClick={onAdd}>
            Add task
          </Button>
        )}
      </div>
      {stage.tasks.length === 0 && (
        <p className="rounded-md border border-dashed border-rule px-4 py-6 text-center type-body-sm text-ink-muted">
          No tasks yet. Add the first piece of work in this stage.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-raised">
        {stage.tasks.map((task, index) => {
          const problems = taskIssues(issues, task.key).length;
          return (
            <li
              key={task.key}
              className="group flex items-center gap-2 pr-2 transition-colors hover:bg-sunken/40"
            >
              <button
                type="button"
                aria-label={`Open ${task.title || 'Untitled task'}${problems > 0 ? `, ${pluralize(problems, 'problem')}` : ''}`}
                onClick={() => onOpen(index)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-4 py-3 text-left"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate type-body font-medium text-ink">
                    {task.title || 'Untitled task'}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body-sm text-ink-muted">
                    <span>{roleLabel(task.responsibleRole)}</span>
                    <span>
                      {task.durationDays} {task.durationDays === 1 ? 'day' : 'days'}
                    </span>
                    <PriorityMarker priority={task.priority} />
                    {task.requiresReview && <span>Reviewed</span>}
                    {task.dependsOn.length > 0 && (
                      <span>
                        After {task.dependsOn.length}{' '}
                        {task.dependsOn.length === 1 ? 'task' : 'tasks'}
                      </span>
                    )}
                    {problems > 0 && (
                      <span className="inline-flex items-center gap-1 text-overdue">
                        <StatusGlyph name="overdue" className="size-3" />
                        {problems} {problems === 1 ? 'problem' : 'problems'}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
              </button>
              {!readOnly && stage.tasks.length > 1 && (
                <span className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton
                    label={`Move ${task.title} earlier`}
                    size="sm"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Move ${task.title} later`}
                    size="sm"
                    disabled={index === stage.tasks.length - 1}
                    onClick={() => onMove(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </IconButton>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
