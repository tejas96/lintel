import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import {
  useCancelLeave,
  useDecideLeave,
  useRespondToLeaveInfoRequest,
} from '@/queries/leave-queries';
import { SPACE } from '@/theme/layout';

type Decision = 'approve' | 'reject' | 'request_info';

const DONE_MESSAGE: Readonly<Record<Decision, string>> = {
  approve: 'Leave approved.',
  reject: 'Leave declined.',
  request_info: 'Asked for more information.',
};

/** Approve, decline or ask for information — offered only when the server says `viewerCanDecide`. */
export function LeaveDecisionPanel({ request }: { readonly request: LeaveRequestDetail }) {
  const toast = useToast();
  const decide = useDecideLeave(request.id);
  const [note, setNote] = useState('');
  const run = (decision: Decision) =>
    decide.mutate(
      { decision, note: note.trim() || null, version: request.version },
      {
        onSuccess: (updated) =>
          toast.show(
            decision === 'approve' && updated.status === 'pending'
              ? 'Your approval is recorded. It now goes to the next approver.'
              : DONE_MESSAGE[decision],
            'success',
          ),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  const pending = decide.isPending ? decide.variables?.decision : undefined;
  return (
    <Card tone="raised" style={{ gap: SPACE.md }}>
      <AppText variant="titleMd">Your decision</AppText>
      <TextField
        label="Note to the person (optional for approval)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
      />
      <Button
        label="Approve"
        icon="done"
        size="lg"
        onPress={() => run('approve')}
        loading={pending === 'approve'}
        disabled={decide.isPending}
      />
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <Button
          label="Ask for info"
          variant="secondary"
          onPress={() => run('request_info')}
          loading={pending === 'request_info'}
          disabled={decide.isPending || note.trim().length < 3}
          accessibilityHint="Write what you need in the note first"
          fill
        />
        <Button
          label="Decline"
          variant="danger"
          onPress={() => run('reject')}
          loading={pending === 'reject'}
          disabled={decide.isPending || note.trim().length < 3}
          accessibilityHint="Write the reason in the note first"
          fill
        />
      </View>
      <AppText variant="bodySm" tone="tertiary">
        Asking for information or declining needs a short note.
      </AppText>
    </Card>
  );
}

/** The requester's own actions: answer an information request, or cancel. */
export function LeaveOwnerActions({ request }: { readonly request: LeaveRequestDetail }) {
  const toast = useToast();
  const cancel = useCancelLeave(request.id);
  const respond = useRespondToLeaveInfoRequest(request.id);
  const [answer, setAnswer] = useState('');
  const confirmCancel = () =>
    Alert.alert('Cancel this leave request?', 'Your approver will be told it’s withdrawn.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(
            { note: null, version: request.version },
            {
              onSuccess: () => toast.show('Leave request cancelled.', 'success'),
              onError: (error) => toast.show(errorMessage(error), 'error'),
            },
          ),
      },
    ]);
  const needsAnswer = request.status === 'info_requested';
  if (!needsAnswer && !request.viewerCanCancel) return null;
  return (
    <View style={{ gap: SPACE.md }}>
      {needsAnswer ? (
        <Card tone="raised" style={{ gap: SPACE.md }}>
          <AppText variant="titleMd">Your approver asked for more information</AppText>
          <TextField
            label="Your answer"
            value={answer}
            onChangeText={setAnswer}
            multiline
            maxLength={2000}
          />
          <Button
            label="Send answer"
            size="lg"
            loading={respond.isPending}
            disabled={answer.trim().length < 3}
            onPress={() =>
              respond.mutate(
                { reason: answer.trim(), handovers: [], version: request.version },
                {
                  onSuccess: () => toast.show('Answer sent.', 'success'),
                  onError: (error) => toast.show(errorMessage(error), 'error'),
                },
              )
            }
          />
        </Card>
      ) : null}
      {request.viewerCanCancel ? (
        <Button
          label="Cancel request"
          variant="danger"
          onPress={confirmCancel}
          loading={cancel.isPending}
        />
      ) : null}
    </View>
  );
}
