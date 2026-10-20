import type { TaskDetail } from '@lintel/api-contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { SheetLayout } from '@/components/sheet-layout';
import { SkeletonList } from '@/components/skeleton';
import { InlineError } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import { useTask, useTransitionTask } from '@/queries/task-queries';

export function TransitionSheet() {
  const { id, to } = useLocalSearchParams<{ id: string; to: string }>();
  const task = useTask(id);
  if (task.data) return <TransitionForm task={task.data} to={to} />;
  return (
    <SheetLayout title="Change status">
      {task.isError ? (
        <InlineError error={task.error} onRetry={() => void task.refetch()} />
      ) : (
        <SkeletonList count={1} />
      )}
    </SheetLayout>
  );
}

/** A status change the server says needs a short note (e.g. requesting changes). */
function TransitionForm({ task, to }: { readonly task: TaskDetail; readonly to: string }) {
  const router = useRouter();
  const toast = useToast();
  const transition = useTransitionTask(task.id);
  const option = task.transitions.find((candidate) => candidate.to === to);
  const [note, setNote] = useState('');
  if (!option) {
    return (
      <SheetLayout title="Change status">
        <AppText variant="body" tone="secondary">
          This change is no longer available. The task may have moved on — close this and refresh.
        </AppText>
      </SheetLayout>
    );
  }
  const ready = !option.requiresNote || note.trim().length >= 3;
  const submit = () =>
    transition.mutate(
      { to: option.to, note: note.trim() || null, version: task.version },
      {
        onSuccess: () => {
          toast.show(`${option.label} — done.`, 'success');
          router.back();
        },
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  return (
    <SheetLayout
      title={option.label}
      subtitle={task.title}
      footer={
        <Button
          label={option.label}
          size="lg"
          variant={option.to === 'cancelled' ? 'danger' : 'primary'}
          onPress={submit}
          loading={transition.isPending}
          disabled={!ready || !option.allowed}
        />
      }
    >
      {option.allowed ? null : (
        <AppText variant="bodySm" tone="secondary">
          {option.reasons.join(' ')}
        </AppText>
      )}
      <TextField
        label={option.requiresNote ? 'Note (required)' : 'Note (optional)'}
        hint="Everyone on the task will see this."
        value={note}
        onChangeText={setNote}
        multiline
        autoFocus
        maxLength={2000}
      />
    </SheetLayout>
  );
}
