import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { fieldErrors, isNotFound, unshownErrorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SheetLayout } from '@/components/sheet-layout';
import { SkeletonList } from '@/components/skeleton';
import { InlineError } from '@/components/state-views';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import {
  useMyMilestoneRewards,
  useMyRewardEvaluations,
  useRaiseRewardChallenge,
} from '@/queries/reward-queries';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { rewardStatusPresentation } from '@/theme/status-vocabulary';
import { findRewardRecord, type RewardRecord } from './reward-records';

/** The server checks the same limits (10 to 2,000 characters after trimming). */
const MIN_REASON = 10;
const MAX_REASON = 2000;
const TITLE = 'Challenge this result';

/** A refusal in words, or null when the problem is already shown beside the field. */
function refusalMessage(error: unknown): string | null {
  if (isNotFound(error)) {
    return 'This record is no longer yours to challenge, or it was removed. Close this and pull down to refresh.';
  }
  return unshownErrorMessage(error, ['reason']);
}

/** Errors stay inside the sheet: a toast would sit underneath it. */
function SheetAlert({ message }: { readonly message: string }) {
  const { status } = useAppTheme();
  return (
    <View
      style={[styles.alert, { backgroundColor: status.overdue.tint }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name="error" size={16} color={status.overdue.fg} style={styles.alertIcon} />
      <AppText variant="bodySm" color={status.overdue.fg} style={styles.flex}>
        {message}
      </AppText>
    </View>
  );
}

function ChallengeForm({ record }: { readonly record: RewardRecord }) {
  const router = useRouter();
  const toast = useToast();
  const raise = useRaiseRewardChallenge();
  const [reason, setReason] = useState('');
  const length = reason.trim().length;
  const refusal = raise.isError ? refusalMessage(raise.error) : null;
  const submit = () => {
    if (length < MIN_REASON) return;
    raise.mutate(
      { recordKind: record.kind, recordId: record.id, reason: reason.trim() },
      {
        onSuccess: () => {
          router.back();
          toast.show('Challenge sent. A reviewer will look at this again.', 'success');
        },
      },
    );
  };
  return (
    <SheetLayout
      title={TITLE}
      subtitle={`${record.title} · ${record.context}`}
      footer={
        <Button
          label="Send challenge"
          icon="send"
          size="lg"
          onPress={submit}
          loading={raise.isPending}
          disabled={length < MIN_REASON}
          accessibilityHint={`Write at least ${MIN_REASON} characters first`}
        />
      }
    >
      <StatusPill status={rewardStatusPresentation(record.status)} size="md" />
      <AppText variant="body" tone="secondary">
        Say what you think the rules or the reviewer got wrong: a date, work that was delivered, a
        delay that was not yours. A reviewer looks again and either upholds the result or corrects
        it. A challenge never lowers a reward or takes one away.
      </AppText>
      <TextField
        label="What is wrong"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={MAX_REASON}
        placeholder="e.g. The bill of quantities went to the client by email on 20 Oct."
        hint={
          length < MIN_REASON
            ? `A sentence or two, at least ${MIN_REASON} characters.`
            : `${length} of ${MAX_REASON.toLocaleString('en-IN')} characters`
        }
        error={fieldErrors(raise.error).reason ?? null}
      />
      {refusal ? <SheetAlert message={refusal} /> : null}
    </SheetLayout>
  );
}

/** Opened from a decided record's Challenge button; the record comes from the loaded lists. */
export function ChallengeSheet() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const evaluations = useMyRewardEvaluations();
  const milestones = useMyMilestoneRewards();
  const record = findRewardRecord(
    kind,
    id,
    evaluations.data?.items ?? [],
    milestones.data?.items ?? [],
  );
  if (record) return <ChallengeForm record={record} />;
  const failed = evaluations.error ?? milestones.error;
  const loading = evaluations.isPending || milestones.isPending;
  return (
    <SheetLayout title={TITLE}>
      {failed ? (
        <InlineError
          error={failed}
          onRetry={() => void Promise.all([evaluations.refetch(), milestones.refetch()])}
        />
      ) : loading ? (
        <SkeletonList count={2} />
      ) : (
        <AppText variant="body" tone="secondary">
          This record is not available any more. Close this and pull down on Rewards to refresh.
        </AppText>
      )}
    </SheetLayout>
  );
}

const styles = StyleSheet.create({
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
  },
  alertIcon: { marginTop: 2 },
  flex: { flex: 1 },
});
