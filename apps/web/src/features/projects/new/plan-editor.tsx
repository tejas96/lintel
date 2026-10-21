'use client';

import { Badge, Button, Checkbox, cn } from '@lintel/design-system/web';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatCalendarDate } from '@/lib/format/dates';
import { AddStageForm, AddTaskForm } from './plan-add-forms';
import {
  addStage,
  addTask,
  adjustTask,
  deleteAdded,
  includeItem,
  type PlanDraft,
} from './plan-draft';
import { keptTasks, type OutlineStage } from './plan-outline';
import { PlanTaskRow } from './plan-task-row';

interface PlanEditorProps {
  readonly outline: readonly OutlineStage[];
  readonly draft: PlanDraft;
  readonly onChange: (draft: PlanDraft) => void;
  readonly today: string;
}

/** Stages and tasks to keep, leave out, add and adjust; dates come from the live preview. */
export function PlanEditor({ outline, draft, onChange, today }: PlanEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState(false);
  const kept = keptTasks(outline);
  return (
    <div className="flex flex-col gap-6">
      {outline.map((stage, index) => (
        <section
          key={stage.key}
          aria-labelledby={`plan-stage-${stage.key}`}
          className="flex flex-col gap-1"
        >
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline pb-2">
            <span className="w-6 text-right font-mono text-[0.75rem] text-ink-faint">
              {index + 1}
            </span>
            <h3
              id={`plan-stage-${stage.key}`}
              className={cn(
                'type-title-md text-ink',
                stage.removed && 'text-ink-faint line-through',
              )}
            >
              {stage.name}
            </h3>
            {stage.isAdded && <Badge variant="accent">New stage</Badge>}
            {!stage.removed && stage.plannedStartDate && stage.plannedEndDate && (
              <span className="type-body-sm text-ink-faint tabular-nums">
                {formatCalendarDate(stage.plannedStartDate, today)} –{' '}
                {formatCalendarDate(stage.plannedEndDate, today)}
              </span>
            )}
            <span className="ml-auto">
              {stage.isAdded ? (
                <Button
                  size="sm"
                  variant="quiet"
                  leadingIcon={<Trash2 aria-hidden />}
                  onClick={() => onChange(deleteAdded(draft, stage.key))}
                >
                  Remove stage
                </Button>
              ) : (
                <Checkbox
                  label="Keep this stage"
                  checked={!stage.removed}
                  onCheckedChange={(include) =>
                    onChange(includeItem(draft, 'stage', stage.key, include))
                  }
                  className="py-0"
                />
              )}
            </span>
          </header>
          <ul className="flex flex-col">
            {stage.tasks.map((task) => (
              <PlanTaskRow
                key={task.key}
                task={task}
                today={today}
                expanded={expanded === task.key}
                onExpand={(open) => setExpanded(open ? task.key : null)}
                onInclude={(include) => onChange(includeItem(draft, 'task', task.key, include))}
                onAdjust={(field, value) => onChange(adjustTask(draft, task.key, field, value))}
                onDelete={() => onChange(deleteAdded(draft, task.key))}
                onReset={() => {
                  const { [task.key]: _cleared, ...rest } = draft.adjustments;
                  onChange({ ...draft, adjustments: rest });
                }}
              />
            ))}
            {stage.tasks.length === 0 && (
              <li className="px-2 py-3 type-body-sm text-ink-faint">No tasks yet.</li>
            )}
          </ul>
          {!stage.removed &&
            (addingTo === stage.key ? (
              <AddTaskForm
                stageName={stage.name}
                tasks={kept}
                onCancel={() => setAddingTo(null)}
                onAdd={(task) => {
                  onChange(
                    addTask(draft, {
                      ...task,
                      stageKey: stage.key,
                      priority: 'medium',
                      responsibleRole: 'member',
                    }),
                  );
                  setAddingTo(null);
                }}
              />
            ) : (
              <Button
                size="sm"
                variant="quiet"
                leadingIcon={<Plus aria-hidden />}
                onClick={() => setAddingTo(stage.key)}
                className="self-start"
              >
                Add a task
              </Button>
            ))}
        </section>
      ))}
      {addingStage ? (
        <AddStageForm
          stages={outline.map((stage) => ({ key: stage.key, name: stage.name }))}
          onCancel={() => setAddingStage(false)}
          onAdd={(stage) => {
            onChange(addStage(draft, stage.name, stage.afterStageKey));
            setAddingStage(false);
          }}
        />
      ) : (
        <Button
          variant="secondary"
          leadingIcon={<Plus aria-hidden />}
          onClick={() => setAddingStage(true)}
          className="self-start"
        >
          Add a stage
        </Button>
      )}
    </div>
  );
}
