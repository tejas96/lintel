'use client';

import { Checkbox, Input } from '@lintel/design-system/web';
import { wouldCreateDependencyCycle } from '@lintel/domain';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { allTasks, type TemplateTask, type WorkflowDefinition } from '../template-types';

interface DependencyPickerProps {
  readonly definition: WorkflowDefinition;
  readonly task: TemplateTask;
  readonly onChange: (dependsOn: string[]) => void;
  readonly readOnly: boolean;
  readonly error?: string | undefined;
}

/**
 * Tasks that must finish before this one starts. Choices that would loop back
 * to this task are disabled as a convenience; the server checks again on save.
 */
export function DependencyPicker({
  definition,
  task,
  onChange,
  readOnly,
  error,
}: DependencyPickerProps) {
  const labelId = useId();
  const [filter, setFilter] = useState('');
  const edges = allTasks(definition).flatMap(({ task: other }) =>
    other.dependsOn.map((dependency) => ({ taskId: other.key, dependsOnTaskId: dependency })),
  );
  const chosen = new Set(task.dependsOn);
  const needle = filter.trim().toLowerCase();
  const groups = definition.stages
    .map((stage) => ({
      stage,
      tasks: stage.tasks.filter(
        (other) =>
          other.key !== task.key && (!needle || other.title.toLowerCase().includes(needle)),
      ),
    }))
    .filter((group) => group.tasks.length > 0);
  const toggle = (key: string, on: boolean) =>
    onChange(
      on ? [...task.dependsOn, key] : task.dependsOn.filter((dependency) => dependency !== key),
    );

  return (
    <fieldset aria-describedby={labelId} className="flex flex-col gap-2">
      <legend className="contents">
        <span className="type-label text-ink-muted">Starts after</span>
      </legend>
      <div className="flex flex-col gap-0.5">
        <span id={labelId} className="type-body-sm text-ink-faint">
          {chosen.size === 0
            ? 'No prerequisites: it can start when its stage starts.'
            : `${chosen.size} ${chosen.size === 1 ? 'task' : 'tasks'} must finish first.`}
        </span>
      </div>
      {error && (
        <p role="alert" className="type-body-sm text-overdue">
          {error}
        </p>
      )}
      <Input
        type="search"
        aria-label="Find a task"
        placeholder="Find a task"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        leading={<Search aria-hidden />}
        className="h-10"
      />
      <div className="max-h-72 overflow-y-auto rounded-md border border-hairline bg-raised px-3 py-1">
        {groups.length === 0 && <p className="py-3 type-body-sm text-ink-faint">No tasks match.</p>}
        {groups.map(({ stage, tasks }) => (
          <div key={stage.key} className="border-b border-hairline py-1 last:border-b-0">
            <p className="pt-2 type-label text-ink-faint">{stage.name}</p>
            {tasks.map((other) => {
              const loops =
                !chosen.has(other.key) &&
                wouldCreateDependencyCycle(edges, { taskId: task.key, dependsOnTaskId: other.key });
              return (
                <Checkbox
                  key={other.key}
                  label={other.title}
                  checked={chosen.has(other.key)}
                  disabled={readOnly || loops}
                  onCheckedChange={(on) => toggle(other.key, on)}
                  {...(loops
                    ? { description: 'Already waits for this task, so it would loop.' }
                    : {})}
                />
              );
            })}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
