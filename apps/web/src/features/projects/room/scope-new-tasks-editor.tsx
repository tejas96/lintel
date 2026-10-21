'use client';

import type { ProjectDetail } from '@lintel/api-contracts';
import { Button, DatePicker, Field, IconButton, Input, Select } from '@lintel/design-system/web';
import type { TaskPriority } from '@lintel/domain';
import { Plus, X } from 'lucide-react';
import { PRIORITY_OPTIONS } from '@/features/templates/template-types';

export interface DraftNewTask {
  readonly key: string;
  readonly title: string;
  readonly stageId: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly ownerUserId: string | null;
  readonly priority: TaskPriority;
}

const UNASSIGNED = 'unassigned';

export function emptyNewTask(project: ProjectDetail): DraftNewTask {
  const stage = project.stages.find((candidate) => candidate.status === 'active');
  return {
    key: crypto.randomUUID(),
    title: '',
    stageId: stage?.id ?? null,
    plannedStartDate: null,
    dueDate: null,
    ownerUserId: null,
    priority: 'medium',
  };
}

/**
 * Tasks the change would add: title, open stage, dates and an owner from the
 * project team. They are created only if the change is approved.
 */
export function ScopeNewTasksEditor({
  project,
  tasks,
  today,
  errors,
  onChange,
}: {
  readonly project: ProjectDetail;
  readonly tasks: readonly DraftNewTask[];
  readonly today: string;
  readonly errors: Readonly<Record<string, string>>;
  readonly onChange: (tasks: DraftNewTask[]) => void;
}) {
  const stages = project.stages
    .filter((stage) => stage.status === 'active' || stage.status === 'pending')
    .map((stage) => ({ value: stage.id, label: stage.name }));
  const owners = [
    { value: UNASSIGNED, label: 'Decide later' },
    ...project.members.map((member) => ({ value: member.user.id, label: member.user.fullName })),
  ];
  const update = (key: string, patch: Partial<DraftNewTask>) =>
    onChange(tasks.map((task) => (task.key === key ? { ...task, ...patch } : task)));
  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task, index) => (
        <fieldset
          key={task.key}
          className="relative flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-4"
        >
          <legend className="sr-only">New task {index + 1}</legend>
          <IconButton
            label={`Remove new task ${index + 1}`}
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => onChange(tasks.filter((candidate) => candidate.key !== task.key))}
          >
            <X aria-hidden />
          </IconButton>
          <Field label="Title" error={errors[`newTasks.${index}.title`]} required className="pr-10">
            <Input
              value={task.title}
              onChange={(event) => update(task.key, { title: event.target.value })}
              maxLength={200}
              placeholder="For example: Design the reading nook"
            />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <Field label="Stage" error={errors[`newTasks.${index}.stageId`]}>
              <Select
                value={task.stageId ?? undefined}
                onValueChange={(stageId) => update(task.key, { stageId })}
                options={stages}
              />
            </Field>
            <Field label="Owner" error={errors[`newTasks.${index}.ownerUserId`]}>
              <Select
                value={task.ownerUserId ?? UNASSIGNED}
                onValueChange={(owner) =>
                  update(task.key, { ownerUserId: owner === UNASSIGNED ? null : owner })
                }
                options={owners}
              />
            </Field>
            <Field label="Starts" error={errors[`newTasks.${index}.plannedStartDate`]}>
              <DatePicker
                value={task.plannedStartDate}
                onValueChange={(plannedStartDate) => update(task.key, { plannedStartDate })}
                today={today}
              />
            </Field>
            <Field label="Due">
              <DatePicker
                value={task.dueDate}
                onValueChange={(dueDate) => update(task.key, { dueDate })}
                today={today}
                {...(task.plannedStartDate ? { min: task.plannedStartDate } : {})}
              />
            </Field>
            <Field label="Priority">
              <Select
                value={task.priority}
                onValueChange={(priority) => update(task.key, { priority })}
                options={PRIORITY_OPTIONS}
              />
            </Field>
          </div>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Plus aria-hidden />}
        className="self-start"
        onClick={() => onChange([...tasks, emptyNewTask(project)])}
      >
        Add a task
      </Button>
    </div>
  );
}
