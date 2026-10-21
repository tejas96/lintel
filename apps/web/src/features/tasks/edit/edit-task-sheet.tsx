'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Button, Sheet, useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { useFieldErrors } from '@/features/common/use-field-errors';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { TaskEditFields } from './task-edit-fields';
import {
  changesOf,
  checkTaskEdit,
  dueDateMoves,
  editValuesOf,
  type TaskEditChanges,
  type TaskEditValues,
} from './task-edit-values';

interface SaveInput {
  readonly changes: TaskEditChanges;
  readonly scheduleChangeReason: string | undefined;
}

/** Saves only the changed fields with the version the form was opened on. */
function useSaveTask(task: TaskDetail) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ changes, scheduleChangeReason }: SaveInput) =>
      expectStatus(
        api.tasks.updateTask({
          params: { id: task.id },
          body: {
            ...changes,
            version: task.version,
            ...(scheduleChangeReason ? { scheduleChangeReason } : {}),
          },
        }),
        200,
      ),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.task(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allTaskLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(detail.project.id) });
    },
  });
}

/** "Edit details" for people who may edit the task (owner or manager). */
export function EditTaskButton({
  task,
  today,
}: {
  readonly task: TaskDetail;
  readonly today: string;
}) {
  const [open, setOpen] = useState(false);
  if (!task.viewerCanEdit) return null;
  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        leadingIcon={<Pencil aria-hidden />}
        onClick={() => setOpen(true)}
        className="self-start"
      >
        Edit details
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        autoFocusField
        width="lg"
        title="Edit task"
        description={`#${task.number} · ${task.project.name}`}
      >
        <TaskEditForm key={task.version} task={task} today={today} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function TaskEditForm({
  task,
  today,
  onDone,
}: {
  readonly task: TaskDetail;
  readonly today: string;
  readonly onDone: () => void;
}) {
  const toast = useToast();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const queryClient = useQueryClient();
  const save = useSaveTask(task);
  const [values, setValues] = useState<TaskEditValues>(() => editValuesOf(task));
  const fields = useFieldErrors((next: TaskEditValues) => checkTaskEdit(task, next));
  const changes = changesOf(task, values);
  const hasChanges = Object.keys(changes).length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!fields.validate(values) || !hasChanges) return;
    const reason = dueDateMoves(task, values) ? values.scheduleChangeReason.trim() : undefined;
    save.mutate(
      { changes, scheduleChangeReason: reason },
      {
        onSuccess: (detail) => {
          toast({ tone: 'success', title: 'Task updated', description: detail.title });
          onDone();
        },
        onError: (error) => {
          if (staleness.catchStale(error)) return;
          if (isApiError(error)) fields.showServerErrors(error.fieldErrors());
          fail(error, 'save the task');
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8 p-5 sm:p-6" noValidate>
      <StaleVersionNotice
        show={staleness.stale}
        message="Someone else changed this task while you were editing. Refresh to load their changes, then make yours again."
        onRefresh={() => {
          staleness.clear();
          void queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
        }}
      />
      <TaskEditFields
        task={task}
        values={values}
        onChange={(next) => {
          setValues(next);
          fields.recheck(next);
        }}
        errors={fields.errors}
        today={today}
      />
      <div className="flex justify-end gap-2 border-t border-hairline pt-5">
        <Button variant="quiet" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={save.isPending}
          disabled={!hasChanges || staleness.stale}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
