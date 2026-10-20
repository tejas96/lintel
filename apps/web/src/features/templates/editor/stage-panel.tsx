'use client';

import { Button, Checkbox, Field, Input, Textarea } from '@lintel/design-system/web';
import { Trash2 } from 'lucide-react';
import { addTask, moveTask, updateStage, withOptional } from '../definition-edits';
import { fieldMessage, type TemplateIssue } from '../template-issues';
import type { TemplateStage, WorkflowDefinition } from '../template-types';
import { MilestonesEditor } from './milestones-editor';
import { TaskList } from './task-list';

interface StagePanelProps {
  readonly definition: WorkflowDefinition;
  readonly stageIndex: number;
  readonly issues: readonly TemplateIssue[];
  readonly readOnly: boolean;
  readonly edit: (change: (definition: WorkflowDefinition) => WorkflowDefinition) => void;
  readonly onOpenTask: (taskKey: string) => void;
  readonly onRemove: () => void;
}

/** Everything about one stage: its name, when it applies, its milestones and its tasks. */
export function StagePanel({
  definition,
  stageIndex,
  issues,
  readOnly,
  edit,
  onOpenTask,
  onRemove,
}: StagePanelProps) {
  const stage = definition.stages[stageIndex];
  if (!stage) return null;
  const isThisStage = (target: TemplateIssue['target']) =>
    target.kind === 'stage' && target.stageKey === stage.key;
  const change = (patch: (current: TemplateStage) => TemplateStage) =>
    edit((current) => updateStage(current, stageIndex, patch));
  const required = new Set(stage.requiresOptions ?? []);
  const toggleOption = (key: string, on: boolean) =>
    change((current) => {
      const next = new Set(current.requiresOptions ?? []);
      if (on) next.add(key);
      else next.delete(key);
      return withOptional(current, 'requiresOptions', next.size > 0 ? [...next] : undefined);
    });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-display-md text-ink">
            <span className="mr-2 text-accent tabular-nums">{stageIndex + 1}</span>
            {stage.name || 'Untitled stage'}
          </h2>
          {!readOnly && definition.stages.length > 1 && (
            <Button
              size="sm"
              variant="quiet"
              leadingIcon={<Trash2 aria-hidden />}
              onClick={onRemove}
            >
              Remove stage
            </Button>
          )}
        </div>
        <Field label="Stage name" error={fieldMessage(issues, isThisStage, 'name')} required>
          <Input
            value={stage.name}
            disabled={readOnly}
            maxLength={120}
            onChange={(event) => change((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Field
          label="What happens in this stage"
          hint="Optional. Shown to the project team."
          error={fieldMessage(issues, isThisStage, 'description')}
        >
          <Textarea
            value={stage.description ?? ''}
            disabled={readOnly}
            rows={2}
            maxLength={2000}
            onChange={(event) =>
              change((current) =>
                withOptional(current, 'description', event.target.value || undefined),
              )
            }
          />
        </Field>
        {definition.options.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="type-label text-ink-muted">Only include this stage when</legend>
            {definition.options.map((option) => (
              <Checkbox
                key={option.key}
                label={option.label}
                checked={required.has(option.key)}
                disabled={readOnly}
                onCheckedChange={(checked) => toggleOption(option.key, checked)}
              />
            ))}
            <p className="type-body-sm text-ink-faint">
              Leave all unticked to include it in every project.
            </p>
          </fieldset>
        )}
      </section>
      <TaskList
        stage={stage}
        issues={issues}
        readOnly={readOnly}
        onOpen={(taskIndex) => {
          const key = stage.tasks[taskIndex]?.key;
          if (key) onOpenTask(key);
        }}
        onMove={(taskIndex, direction) =>
          edit((current) => moveTask(current, stageIndex, taskIndex, direction))
        }
        onAdd={() => {
          const added = addTask(definition, stageIndex);
          edit(() => added.definition);
          onOpenTask(added.key);
        }}
      />
      <MilestonesEditor
        stage={stage}
        stageIndex={stageIndex}
        issues={issues}
        readOnly={readOnly}
        edit={edit}
      />
    </div>
  );
}
