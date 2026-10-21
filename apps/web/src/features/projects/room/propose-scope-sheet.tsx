'use client';

import type { ProjectDetail, TaskSummary } from '@lintel/api-contracts';
import { Button, Field, Input, SegmentedControl, Sheet, Textarea } from '@lintel/design-system/web';
import { useEffect, useRef, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { ScopeAdditions } from './scope-additions';
import { ScopeCancelPicker } from './scope-cancel-picker';
import { ScopeImpacts } from './scope-impacts';
import { ScopeMovesEditor } from './scope-moves-editor';
import { type DraftNewTask, ScopeNewTasksEditor } from './scope-new-tasks-editor';
import { type ScopeRequest, useScopeChangeMutations } from './use-scope-changes';

type Part = 'moves' | 'additions' | 'cancellations';

interface ProposeScopeSheetProps {
  readonly project: ProjectDetail;
  readonly tasks: readonly TaskSummary[];
  readonly today: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Move dates, add tasks and cancel tasks in one proposal; see every
 * knock-on date and the end-date effect before anything is saved.
 */
export function ProposeScopeSheet({
  project,
  tasks,
  today,
  open,
  onOpenChange,
}: ProposeScopeSheetProps) {
  const { preview, propose } = useScopeChangeMutations(project.id);
  const [part, setPart] = useState<Part>('moves');
  const [shifts, setShifts] = useState<Readonly<Record<string, number>>>({});
  const [newTasks, setNewTasks] = useState<DraftNewTask[]>([]);
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const impactRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (preview.data) impactRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [preview.data]);
  const request: ScopeRequest = {
    taskShifts: Object.entries(shifts)
      .filter(([, days]) => days !== 0)
      .map(([taskId, shiftWorkingDays]) => ({ taskId, shiftWorkingDays })),
    newTasks: newTasks.map(({ key: _key, ...task }) => ({ ...task, title: task.title.trim() })),
    cancelTaskIds: [...cancelling],
  };
  const empty =
    request.taskShifts.length + request.newTasks.length + request.cancelTaskIds.length === 0;
  const fieldErrors = isApiError(preview.error) ? preview.error.fieldErrors() : {};
  const shift = (taskId: string, delta: number) => {
    preview.reset();
    setShifts((current) => ({
      ...current,
      [taskId]: Math.max(-60, Math.min(120, (current[taskId] ?? 0) + delta)),
    }));
  };
  const changeNewTasks = (next: DraftNewTask[]) => {
    preview.reset();
    setNewTasks(next);
  };
  const toggleCancel = (taskId: string, cancel: boolean) => {
    preview.reset();
    setCancelling((current) => {
      const next = new Set(current);
      if (cancel) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };
  const reset = () => {
    setShifts({});
    setNewTasks([]);
    setCancelling(new Set());
    setTitle('');
    setDescription('');
    setPart('moves');
    preview.reset();
  };
  const submit = () => {
    if (title.trim().length < 1 || description.trim().length < 3) {
      setError('Give the change a title and say why it is needed.');
      return;
    }
    setError(null);
    propose.mutate(
      { ...request, title: title.trim(), description: description.trim() },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };
  const moving = new Set(request.taskShifts.map((shift) => shift.taskId));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title="Propose a scope change"
      description="Move dates, add tasks or cancel tasks. Lintel shows every date that follows before anything is saved."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {preview.data ? (
            <Button variant="primary" pending={propose.isPending} onClick={submit}>
              Propose change
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={empty}
              pending={preview.isPending}
              onClick={() => preview.mutate(request)}
            >
              Preview the impact
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <SegmentedControl
          label="What changes"
          value={part}
          onValueChange={setPart}
          options={[
            { value: 'moves', label: `Move dates${moving.size ? ` (${moving.size})` : ''}` },
            {
              value: 'additions',
              label: `Add tasks${newTasks.length ? ` (${newTasks.length})` : ''}`,
            },
            {
              value: 'cancellations',
              label: `Cancel tasks${cancelling.size ? ` (${cancelling.size})` : ''}`,
            },
          ]}
          className="self-start max-w-full overflow-x-auto"
        />
        {part === 'moves' && (
          <ScopeMovesEditor
            tasks={tasks}
            shifts={shifts}
            today={today}
            cancelling={cancelling}
            onShift={shift}
          />
        )}
        {part === 'additions' && (
          <ScopeNewTasksEditor
            project={project}
            tasks={newTasks}
            today={today}
            errors={fieldErrors}
            onChange={changeNewTasks}
          />
        )}
        {part === 'cancellations' && (
          <ScopeCancelPicker
            tasks={tasks}
            chosen={cancelling}
            moving={moving}
            onToggle={toggleCancel}
          />
        )}
        {preview.data && (
          <div
            ref={impactRef}
            className="flex scroll-mt-4 flex-col gap-6 border-t border-hairline pt-6"
          >
            <h3 className="type-title-md text-ink">What this change does</h3>
            <ScopeImpacts
              impacts={preview.data.impacts}
              projectEndImpactDays={preview.data.projectEndImpactDays}
              today={today}
            />
            <ScopeAdditions
              added={preview.data.newTasks.map((task, index) => ({
                key: `${index}-${task.title}`,
                title: task.title,
                stageName: project.stages.find((stage) => stage.id === task.stageId)?.name ?? null,
                dueDate: task.dueDate,
                ownerName:
                  project.members.find((member) => member.user.id === task.ownerUserId)?.user
                    .fullName ?? null,
                createdTaskId: null,
              }))}
              cancelled={preview.data.cancellations.map((task) => ({
                taskId: task.taskId,
                title: task.taskTitle,
                outcome: 'pending' as const,
                skipReason: null,
              }))}
              today={today}
            />
            <Field label="Title" required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="For example: Client added a study to the brief"
              />
            </Field>
            <Field label="Why is this needed?" error={error} required>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
              />
            </Field>
          </div>
        )}
      </div>
    </Sheet>
  );
}
