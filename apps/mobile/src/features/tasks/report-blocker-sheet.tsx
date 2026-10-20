import type { Blocker, TaskDetail, UserSummary } from '@lintel/api-contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { errorMessage, fieldErrors } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { SheetLayout } from '@/components/sheet-layout';
import { SkeletonList } from '@/components/skeleton';
import { InlineError } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { PersonPicker } from '@/features/people/person-picker';
import { useToast } from '@/feedback/toast';
import { useReportBlocker, useTask } from '@/queries/task-queries';
import { BLOCKER_CATEGORY_LABELS } from './blockers-section';
import { blockerRefusal } from './task-affordances';

const CATEGORY_OPTIONS = (Object.keys(BLOCKER_CATEGORY_LABELS) as Blocker['category'][]).map(
  (value) => ({ value, label: BLOCKER_CATEGORY_LABELS[value] }),
);

export function ReportBlockerSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  if (task.data) return <ReportBlockerForm task={task.data} />;
  return (
    <SheetLayout title="Report a blocker">
      {task.isError ? (
        <InlineError error={task.error} onRetry={() => void task.refetch()} />
      ) : (
        <SkeletonList count={2} />
      )}
    </SheetLayout>
  );
}

/** Say what the task is waiting on; the server blocks it and tells the managers. */
function ReportBlockerForm({ task }: { readonly task: TaskDetail }) {
  const router = useRouter();
  const toast = useToast();
  const report = useReportBlocker(task.id);
  const [category, setCategory] = useState<Blocker['category'] | null>(null);
  const [reason, setReason] = useState('');
  const [waitingOn, setWaitingOn] = useState<UserSummary | null>(null);
  const errors = fieldErrors(report.error);
  const refusal = blockerRefusal(task);
  const ready = refusal.length === 0 && category !== null && reason.trim().length >= 3;

  const submit = () => {
    if (!category || !ready) return;
    report.mutate(
      {
        category,
        reason: reason.trim(),
        waitingOnUserId: waitingOn?.id ?? null,
        version: task.version,
      },
      {
        onSuccess: () => {
          toast.show('Blocker reported. Your manager has been told.', 'success');
          router.back();
        },
        onError: (error) => {
          if (Object.keys(fieldErrors(error)).length === 0)
            toast.show(errorMessage(error), 'error');
        },
      },
    );
  };

  return (
    <SheetLayout
      title="Report a blocker"
      subtitle={task.title}
      footer={
        <Button
          label="Report blocker"
          size="lg"
          onPress={submit}
          loading={report.isPending}
          disabled={!ready}
        />
      }
    >
      {refusal.length > 0 ? (
        <AppText variant="bodySm" tone="secondary">
          {refusal.join(' ')}
        </AppText>
      ) : null}
      <AppText variant="label" tone="secondary">
        What is it waiting on?
      </AppText>
      <ChoiceChips
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={setCategory}
        accessibilityLabel="Blocker category"
      />
      <TextField
        label="What’s in the way"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={2000}
        placeholder="e.g. Client hasn’t confirmed the marble finish"
        error={errors.reason ?? null}
      />
      <PersonPicker
        label="Waiting on someone in the studio? (optional)"
        selected={waitingOn}
        onSelect={setWaitingOn}
      />
    </SheetLayout>
  );
}
