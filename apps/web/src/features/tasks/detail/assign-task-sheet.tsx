'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Button, Field, Sheet, Textarea, useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserRoundPen } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AwayWarning, useAwayByPerson } from '@/features/leave/people-away';
import { PersonCombobox } from '@/features/people/person-combobox';
import { api, expectStatus } from '@/lib/api/api-client';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

function useAssign(task: TaskDetail) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (input: { ownerUserId: string; reason: string | null }) =>
      expectStatus(
        api.tasks.assignTask({
          params: { id: task.id },
          body: { ...input, version: task.version },
        }),
        200,
      ),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.task(detail.id), detail);
      for (const queryKey of [
        queryKeys.allTaskLists,
        queryKeys.workQueue,
        ['leave'],
        ['projects', 'detail'],
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
      toast({
        tone: 'success',
        title: 'Owner changed',
        description: `${detail.owner?.fullName ?? 'The new owner'} has been told.`,
      });
    },
    onError: (error) => fail(error, 'change the owner', [queryKeys.task(task.id)]),
  });
}

/**
 * The project manager gives the task to someone else (audited; both people
 * are told). A cover suggestion opens it with `?assignTo=<person>` already
 * chosen; nothing changes until the manager confirms.
 */
export function AssignTaskButton({ task }: { readonly task: TaskDetail }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const suggested = params.get('assignTo');
  const [open, setOpen] = useState(Boolean(suggested));
  const [owner, setOwner] = useState<string | null>(suggested);
  const [reason, setReason] = useState(suggested ? 'Covering while the owner is away.' : '');
  const [error, setError] = useState<string | null>(null);
  const assign = useAssign(task);
  const away = useAwayByPerson(task.id, open);
  if (!task.viewerCanManage || task.status === 'done' || task.status === 'cancelled') return null;
  const close = () => {
    setOpen(false);
    setError(null);
    if (suggested) router.replace(pathname, { scroll: false });
  };
  const submit = () => {
    if (!owner) return setError('Choose who should own the task.');
    assign.mutate({ ownerUserId: owner, reason: reason.trim() || null }, { onSuccess: close });
  };
  return (
    <>
      <Button
        size="sm"
        variant="quiet"
        leadingIcon={<UserRoundPen aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Change owner
      </Button>
      <Sheet
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title="Change the owner"
        description={
          suggested
            ? `Suggested as cover. “${task.title}” moves only when you confirm.`
            : `Who should own “${task.title}” from now on?`
        }
        footer={
          <>
            <Button variant="quiet" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" pending={assign.isPending} onClick={submit}>
              Give the task to them
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <Field
            label="New owner"
            error={error}
            hint="They are told straight away; the current owner hears too."
          >
            <PersonCombobox
              value={owner}
              onValueChange={setOwner}
              away={away.labels}
              excludeIds={[task.owner?.id, task.reviewer?.id].filter((id): id is string =>
                Boolean(id),
              )}
            />
          </Field>
          <AwayWarning userId={owner} away={away} />
          <Field label="Reason" hint="Optional. Kept in the audit log.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
