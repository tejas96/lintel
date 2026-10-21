'use client';

import { Button, Field, Input, Select } from '@lintel/design-system/web';
import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';

const NOTHING = 'none';

interface AddTaskFormProps {
  readonly stageName: string;
  /** Tasks the new one may wait for. */
  readonly tasks: readonly { key: string; title: string }[];
  readonly onAdd: (task: { title: string; durationDays: number; dependsOn: string[] }) => void;
  readonly onCancel: () => void;
}

/** A task the template does not have, added to one stage. */
export function AddTaskForm({ stageName, tasks, onAdd, onCancel }: AddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [days, setDays] = useState('2');
  const [waitsFor, setWaitsFor] = useState<string>(NOTHING);
  const duration = Number(days);
  const valid =
    title.trim().length >= 2 && Number.isInteger(duration) && duration >= 1 && duration <= 300;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onAdd({ title, durationDays: duration, dependsOn: waitsFor === NOTHING ? [] : [waitsFor] });
  };
  return (
    <form
      onSubmit={submit}
      aria-label={`Add a task to ${stageName}`}
      className="grid gap-3 rounded-md border border-dashed border-rule p-3 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,14rem)]"
    >
      <Field label="Task">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="For example: Visit the marble yard"
          autoFocus
        />
      </Field>
      <Field label="Working days">
        <Input
          inputMode="numeric"
          value={days}
          onChange={(event) => setDays(event.target.value.replace(/\D/g, '').slice(0, 3))}
        />
      </Field>
      <Field label="Starts after">
        <Select
          value={waitsFor}
          onValueChange={setWaitsFor}
          options={[
            { value: NOTHING, label: 'The project start' },
            ...tasks.map((task) => ({ value: task.key, label: task.title })),
          ]}
        />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          type="submit"
          disabled={!valid}
          leadingIcon={<Plus aria-hidden />}
        >
          Add task
        </Button>
      </div>
    </form>
  );
}

interface AddStageFormProps {
  readonly stages: readonly { key: string; name: string }[];
  readonly onAdd: (stage: { name: string; afterStageKey: string | null }) => void;
  readonly onCancel: () => void;
}

const FIRST = 'first';

/** A stage the template does not have, placed after an existing one. */
export function AddStageForm({ stages, onAdd, onCancel }: AddStageFormProps) {
  const [name, setName] = useState('');
  const [after, setAfter] = useState<string>(stages.at(-1)?.key ?? FIRST);
  const valid = name.trim().length >= 2;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onAdd({ name, afterStageKey: after === FIRST ? null : after });
  };
  return (
    <form
      onSubmit={submit}
      aria-label="Add a stage"
      className="grid gap-3 rounded-lg border border-dashed border-rule p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]"
    >
      <Field label="Stage">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          placeholder="For example: Terrace garden"
          autoFocus
        />
      </Field>
      <Field label="Comes after">
        <Select
          value={after}
          onValueChange={setAfter}
          options={[
            { value: FIRST, label: 'Nothing: it comes first' },
            ...stages.map((stage) => ({ value: stage.key, label: stage.name })),
          ]}
        />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          type="submit"
          disabled={!valid}
          leadingIcon={<Plus aria-hidden />}
        >
          Add stage
        </Button>
      </div>
    </form>
  );
}
