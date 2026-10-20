import type { DeliverableDetail, DeliverableVersion } from '@lintel/api-contracts';
import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import { useReviewDeliverableVersion } from '@/queries/deliverable-queries';
import { SPACE } from '@/theme/layout';

type Decision = Exclude<DeliverableVersion['decision'], 'pending'>;

const DONE: Readonly<Record<Decision, string>> = {
  approved: 'Approved. The designer has been told.',
  changes_requested: 'Changes requested.',
  rejected: 'Rejected.',
};

/** Approve, request changes or reject the version under review (never one's own). */
export function ReviewPanel({
  deliverable,
  version,
}: {
  readonly deliverable: DeliverableDetail;
  readonly version: DeliverableVersion;
}) {
  const toast = useToast();
  const review = useReviewDeliverableVersion();
  const [comment, setComment] = useState('');
  const pending = review.isPending ? review.variables?.decision : undefined;
  const needsComment = comment.trim().length < 3;
  const run = (decision: Decision) =>
    review.mutate(
      {
        versionId: version.id,
        decision,
        comment: comment.trim() || null,
        version: deliverable.version,
      },
      {
        onSuccess: () => {
          setComment('');
          toast.show(DONE[decision], 'success');
        },
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  return (
    <Card tone="raised" style={{ gap: SPACE.md }}>
      <AppText variant="titleMd">Review version {version.versionNumber}</AppText>
      <TextField
        label="Comment for the designer"
        hint="Required when you request changes or reject."
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={2000}
      />
      <Button
        label="Approve"
        icon="done"
        size="lg"
        onPress={() => run('approved')}
        loading={pending === 'approved'}
        disabled={review.isPending}
      />
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <Button
          label="Request changes"
          variant="secondary"
          onPress={() => run('changes_requested')}
          loading={pending === 'changes_requested'}
          disabled={review.isPending || needsComment}
          fill
        />
        <Button
          label="Reject"
          variant="danger"
          onPress={() => run('rejected')}
          loading={pending === 'rejected'}
          disabled={review.isPending || needsComment}
          fill
        />
      </View>
    </Card>
  );
}
