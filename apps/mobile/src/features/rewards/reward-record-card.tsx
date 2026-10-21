import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { StatusPill } from '@/components/status-pill';
import { SPACE } from '@/theme/layout';
import { rewardStatusPresentation } from '@/theme/status-vocabulary';
import { ChallengeHistory } from './challenge-history';
import { CriteriaFindings } from './criteria-findings';
import { DecisionLine, RecordAmount } from './record-outcome';
import { ProjectLine, QuietNote } from './reward-card-parts';
import type { RewardRecord } from './reward-records';

/** Waiting: everything the rules found. Not granted: only what was not met. */
function findingsToShow(record: RewardRecord) {
  if (record.status === 'pending_review') return record.criteria;
  if (record.status === 'rejected' || record.status === 'ineligible') {
    return record.criteria.filter((finding) => !finding.passed);
  }
  return [];
}

/** The summary explains a result that is waiting or was not granted. */
function showsSummary(record: RewardRecord): boolean {
  return (
    record.status === 'pending_review' ||
    record.status === 'rejected' ||
    record.status === 'ineligible'
  );
}

/** Challenge when the server allows it; otherwise say why, once there is history to explain. */
function ChallengeAction({ record }: { readonly record: RewardRecord }) {
  const router = useRouter();
  if (record.challengeable.allowed) {
    return (
      <Button
        label="Challenge this result"
        icon="challenge"
        variant="secondary"
        accessibilityHint="Ask a reviewer to look at this again, with your reason"
        onPress={() =>
          router.push({
            pathname: '/rewards/challenge',
            params: { kind: record.kind, id: record.id },
          })
        }
      />
    );
  }
  if (record.challenges.length === 0 || !record.challengeable.reason) return null;
  return <QuietNote>{record.challengeable.reason}</QuietNote>;
}

/**
 * One evaluation or milestone reward after the rules ran: status in words, the
 * amount when visible, the findings, the decision and every challenge.
 */
export function RewardRecordCard({ record }: { readonly record: RewardRecord }) {
  const findings = findingsToShow(record);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        {record.projectColorIndex === null ? (
          <AppText variant="overline" tone="secondary" numberOfLines={2}>
            {record.context}
          </AppText>
        ) : (
          <ProjectLine colorIndex={record.projectColorIndex} text={record.context} />
        )}
        <AppText variant="titleLg">{record.title}</AppText>
        <StatusPill status={rewardStatusPresentation(record.status)} size="md" />
      </View>
      <RecordAmount record={record} />
      {showsSummary(record) && record.summary ? (
        <AppText variant="body">{record.summary}</AppText>
      ) : null}
      <CriteriaFindings findings={findings} />
      <DecisionLine record={record} />
      <ChallengeHistory challenges={record.challenges} currency={record.currency} />
      <ChallengeAction record={record} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.lg },
  head: { gap: SPACE.sm },
});
