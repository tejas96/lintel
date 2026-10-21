import type { TaskDetail } from '@lintel/api-contracts';
import { type CalendarDate, calendarDateInTimeZone } from '@lintel/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, type LayoutChangeEvent, View } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { fieldErrors, unshownErrorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { SheetLayout } from '@/components/sheet-layout';
import { SkeletonList } from '@/components/skeleton';
import { InlineError } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import { formatDayMonth } from '@/formatting/dates';
import { useAskDateChange, useTaskDateChanges } from '@/queries/date-change-queries';
import { useTask } from '@/queries/task-queries';
import { useCurrentUser } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';

const TITLE = 'Ask for a new date';

type Field = 'reason' | 'due' | 'start';
type Problem = { readonly field: Field; readonly message: string } | null;

/**
 * A date field's calendar opens in place; once it is laid out, the sheet
 * scrolls so the field and its whole month are in view.
 */
function useRevealOpenedField() {
  const scroller = useRef<KeyboardAwareScrollViewRef>(null);
  const fieldY = useRef<Partial<Record<Field, number>>>({});
  const pending = useRef<Field | null>(null);
  const scrollTo = (field: Field) => {
    const y = fieldY.current[field];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - SPACE.md) });
  };
  const reveal = (field: Field) => {
    if (!Keyboard.isVisible()) {
      Keyboard.dismiss(); // a hardware keyboard: the text field still loses focus
      pending.current = field;
      return;
    }
    // The scroll view returns to its place when the keyboard hides, so scroll after that.
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      subscription.remove();
      scrollTo(field);
    });
    Keyboard.dismiss();
  };
  const onFieldLayout = (field: Field) => (event: LayoutChangeEvent) => {
    fieldY.current[field] = event.nativeEvent.layout.y;
    if (pending.current !== field) return;
    pending.current = null;
    scrollTo(field);
  };
  return { scroller, reveal, onFieldLayout };
}

export function AskDateChangeSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  if (task.data) return <AskDateChangeForm task={task.data} />;
  return (
    <SheetLayout title={TITLE}>
      {task.isError ? (
        <InlineError error={task.error} onRetry={() => void task.refetch()} />
      ) : (
        <SkeletonList count={2} />
      )}
    </SheetLayout>
  );
}

/** The owner or a collaborator asks the project manager for new dates, with a reason. */
function AskDateChangeForm({ task }: { readonly task: TaskDetail }) {
  const router = useRouter();
  const user = useCurrentUser();
  const toast = useToast();
  const ask = useAskDateChange(task.id);
  const changes = useTaskDateChanges(task.id);
  const today = calendarDateInTimeZone(new Date(), user.timeZone);
  const [reason, setReason] = useState('');
  const [due, setDue] = useState<CalendarDate | null>(null);
  const [start, setStart] = useState<CalendarDate | null>(null);
  const [openField, setOpenField] = useState<Field | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const { scroller, reveal, onFieldLayout } = useRevealOpenedField();
  const serverErrors = fieldErrors(ask.error);
  const refusal = changes.data?.viewerCanRequest === false ? changes.data : null;
  const errorFor = (field: Field, serverField: string) =>
    (problem?.field === field ? problem.message : null) ?? serverErrors[serverField] ?? null;
  const toggle = (field: Field) => (open: boolean) => {
    if (open) reveal(field);
    setOpenField(open ? field : null);
  };

  const submit = () => {
    if (!due) return setProblem({ field: 'due', message: 'Choose the new due date.' });
    if (due === task.dueDate) {
      return setProblem({ field: 'due', message: 'Choose a date other than the current one.' });
    }
    if (start && start > due) {
      return setProblem({ field: 'start', message: 'Start on or before the new due date.' });
    }
    if (reason.trim().length < 3) {
      return setProblem({
        field: 'reason',
        message: 'Say why, so the project manager can decide.',
      });
    }
    setProblem(null);
    ask.mutate(
      { reason: reason.trim(), proposedStartDate: start, proposedDueDate: due },
      {
        onSuccess: () => {
          toast.show('Request sent. The project manager will accept or decline it.', 'success');
          router.back();
        },
        onError: (error) => {
          const message = unshownErrorMessage(error, [
            'reason',
            'proposedDueDate',
            'proposedStartDate',
          ]);
          if (message) toast.show(message, 'error');
        },
      },
    );
  };

  const current = task.dueDate ? formatDayMonth(task.dueDate) : 'not set';
  return (
    <SheetLayout
      title={TITLE}
      scrollRef={scroller}
      subtitle={`“${task.title}” is due ${current}. The project manager accepts or declines; nothing moves until then.`}
      footer={
        <Button
          label="Send request"
          icon="send"
          size="lg"
          onPress={submit}
          loading={ask.isPending}
          disabled={refusal !== null}
        />
      }
    >
      {refusal ? (
        <AppText variant="bodySm" tone="secondary">
          {refusal.requestUnavailableReason ?? 'You can’t ask for a new date on this task.'}
        </AppText>
      ) : null}
      <TextField
        label="Why does it need a new date?"
        value={reason}
        onChangeText={setReason}
        onFocus={() => setOpenField(null)}
        multiline
        maxLength={2000}
        placeholder="e.g. The client sends the revised brief on Monday, so the drawings can start on Tuesday."
        error={errorFor('reason', 'reason')}
      />
      <View onLayout={onFieldLayout('due')}>
        <DateField
          label="New due date"
          value={due}
          onChange={setDue}
          today={today}
          min={today}
          open={openField === 'due'}
          onOpenChange={toggle('due')}
          hint={`Now ${current}.`}
          error={errorFor('due', 'proposedDueDate')}
        />
      </View>
      <View onLayout={onFieldLayout('start')}>
        <DateField
          label="New start (optional)"
          value={start}
          onChange={setStart}
          today={today}
          min={today}
          open={openField === 'start'}
          onOpenChange={toggle('start')}
          hint={
            task.plannedStartDate
              ? `Now ${formatDayMonth(task.plannedStartDate)}. Leave empty to keep it.`
              : 'Leave empty to keep it.'
          }
          error={errorFor('start', 'proposedStartDate')}
          clearable
        />
      </View>
    </SheetLayout>
  );
}
