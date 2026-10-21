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
import { useDecideDateChange, useWithdrawDateChange } from '@/queries/date-change-queries';
import { SPACE } from '@/theme/layout';

type Decision = 'accepted' | 'declined';

/** The project manager accepts the new dates or declines with a note. */
export function DateChangeDecisionPanel({ request }: { readonly request: DateChangeRequest }) {
  const toast = useToast();
  const decide = useDecideDateChange();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = (decision: Decision) => {
    if (decision === 'declined' && note.trim().length < 3) {
      haptics.warning();
      setError('Say why, so they know what to do next.');
      return;
    }
    setError(null);
    decide.mutate(
      { request, decision, note: note.trim() || null },
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
  const pending = decide.isPending ? decide.variables?.decision : undefined;
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
      <AppText variant="bodySm" tone="tertiary">
        Accepting moves only this task; the history keeps the old date. Later tasks keep theirs: use
        a scope change to move them too.
      </AppText>
      <Button
        label="Accept the new date"
        icon="done"
        size="lg"
        loading={pending === 'accepted'}
        disabled={decide.isPending}
        onPress={() => run('accepted')}
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
