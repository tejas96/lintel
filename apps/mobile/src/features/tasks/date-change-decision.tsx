import type { DateChangeRequest } from '@lintel/api-contracts';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Divider } from '@/components/section';
import { TextField } from '@/components/text-field';
import { haptics } from '@/feedback/haptics';
import { useToast } from '@/feedback/toast';
import {
  useDateChangeImpact,
  useDecideDateChange,
  useWithdrawDateChange,
} from '@/queries/date-change-queries';
import { SPACE } from '@/theme/layout';
import { DateChangeImpactSummary } from './date-change-impact-summary';

type Decision = 'accept-all' | 'accept-one' | 'declined';

/**
 * The project manager sees what accepting does to the rest of the plan, then
 * accepts (only this task, or with the tasks that wait on it) or declines.
 */
export function DateChangeDecisionPanel({ request }: { readonly request: DateChangeRequest }) {
  const toast = useToast();
  const decide = useDecideDateChange();
  const impact = useDateChangeImpact(request);
  const [choice, setChoice] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = (decision: Decision) => {
    if (decision === 'declined' && note.trim().length < 3) {
      haptics.warning();
      setError('Say why, so they know what to do next.');
      return;
    }
    setError(null);
    setChoice(decision);
    decide.mutate(
      {
        request,
        decision: decision === 'declined' ? 'declined' : 'accepted',
        note: note.trim() || null,
        moveWaitingTasks: decision === 'accept-all',
      },
      {
        onSuccess: (decided) =>
          toast.show(
            `${decided.status === 'accepted' ? 'New date set' : 'Request declined'}. ${decided.requestedBy.fullName} has been told.`,
            'success',
          ),
        onError: (failure) => toast.show(errorMessage(failure), 'error'),
      },
    );
  };
  const pending = decide.isPending ? choice : null;
  const moves = impact.data?.dependentMoves.length ?? 0;
  const canMoveAll = moves > 0 && impact.data?.movingWaitingTasksNeedsScopeChange === false;
  return (
    <View style={styles.panel}>
      <Divider />
      <TextField
        label="Note"
        hint="Optional to accept, needed to decline."
        value={note}
        onChangeText={(text) => {
          setNote(text);
          if (error && text.trim().length >= 3) setError(null);
        }}
        multiline
        maxLength={2000}
        error={error}
      />
      {impact.data ? <DateChangeImpactSummary impact={impact.data} /> : null}
      {canMoveAll ? (
        <Button
          label={moves === 1 ? 'Accept and move the waiting task' : `Accept and move ${moves} tasks`}
          icon="done"
          size="lg"
          loading={pending === 'accept-all'}
          disabled={decide.isPending}
          onPress={() => run('accept-all')}
        />
      ) : null}
      <Button
        label={moves > 0 ? 'Accept only this task' : 'Accept the new date'}
        icon={canMoveAll ? undefined : 'done'}
        variant={canMoveAll ? 'secondary' : undefined}
        size="lg"
        loading={pending === 'accept-one'}
        disabled={decide.isPending || impact.isPending}
        onPress={() => run('accept-one')}
      />
      <Button
        label="Decline"
        variant="danger"
        loading={pending === 'declined'}
        disabled={decide.isPending}
        accessibilityHint="Needs a note saying why"
        onPress={() => run('declined')}
      />
    </View>
  );
}

/** The requester takes back an open request, after a confirmation. */
export function WithdrawDateChangeButton({ request }: { readonly request: DateChangeRequest }) {
  const toast = useToast();
  const withdraw = useWithdrawDateChange();
  const confirm = () =>
    Alert.alert(
      'Withdraw your request?',
      'The project manager will no longer be asked. You can ask again later.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () =>
            withdraw.mutate(request, {
              onSuccess: () => toast.show('Request withdrawn.', 'success'),
              onError: (failure) => toast.show(errorMessage(failure), 'error'),
            }),
        },
      ],
    );
  return (
    <Button
      label="Withdraw my request"
      variant="quiet"
      loading={withdraw.isPending}
      onPress={confirm}
      style={styles.withdraw}
    />
  );
}

const styles = StyleSheet.create({
  panel: { gap: SPACE.md },
  withdraw: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
