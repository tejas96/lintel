import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { PageHeader, ScreenScroll } from '@/components/screen';
import { Section } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import {
  useMyMilestoneRewards,
  useMyRewardEvaluations,
  useRewardPolicies,
} from '@/queries/reward-queries';
import { SPACE } from '@/theme/layout';
import { listEntrance } from '@/theme/motion';
import { PlannedMilestoneCard } from './planned-milestone-card';
import { PolicyCard } from './policy-card';
import { QuietNote } from './reward-card-parts';
import { RewardRecordCard } from './reward-record-card';
import { groupRewardRecords, type RewardRecord } from './reward-records';

interface StaggeredItem {
  readonly key: string;
  readonly node: ReactNode;
}

/** Cards rise in one after another (capped), and simply appear under Reduce Motion. */
function Staggered({ items }: { readonly items: readonly StaggeredItem[] }) {
  return (
    <View style={styles.cards}>
      {items.map((item, index) => (
        <Animated.View key={item.key} entering={listEntrance(index)}>
          {item.node}
        </Animated.View>
      ))}
    </View>
  );
}

const recordItem = (record: RewardRecord): StaggeredItem => ({
  key: `${record.kind}-${record.id}`,
  node: <RewardRecordCard record={record} />,
});

/**
 * My recognition: what earns a reward (policies and planned milestone
 * rewards), what is waiting for a reviewer, and what was decided — with the
 * evidence, the decision and a way to challenge it.
 */
export function RewardsScreen() {
  const policies = useRewardPolicies();
  const evaluations = useMyRewardEvaluations();
  const milestones = useMyMilestoneRewards();
  const queries = [policies, evaluations, milestones] as const;
  const refresh = () => Promise.all(queries.map((query) => query.refetch()));
  // A failed background refetch keeps what is on screen; only a first load can fail the page.
  const failed = queries.find((query) => query.isError && query.data === undefined);
  const ready = queries.every((query) => query.data !== undefined);

  const active = (policies.data ?? []).filter((policy) => policy.isActive);
  const sections = groupRewardRecords(evaluations.data?.items ?? [], milestones.data?.items ?? []);
  const earns = active.length + sections.planned.length;
  const empty = earns + sections.waiting.length + sections.decided.length === 0;

  return (
    <ScreenScroll edge="stack" onRefresh={refresh}>
      <PageHeader
        overline="Recognition"
        title="Rewards"
        subtitle="What earns a reward, what is waiting for a reviewer, and what was decided."
      />
      {failed?.error ? (
        <ErrorState error={failed.error} subject="your rewards" onRetry={() => void refresh()} />
      ) : !ready ? (
        <SkeletonList count={3} label="Loading your rewards" />
      ) : empty ? (
        <EmptyState
          icon="reward"
          title="No rewards yet"
          message="When your studio sets up rewards, you will see here what earns one, and your results after each month, quarter or milestone."
        />
      ) : null}
      {ready && earns > 0 ? (
        <Section title="What earns a reward">
          <QuietNote>
            Every condition must be met, and a reviewer confirms each result. Amounts are visible
            only to you and the people who decide rewards.
          </QuietNote>
          <Staggered
            items={[
              ...active.map((policy) => ({
                key: `policy-${policy.id}`,
                node: <PolicyCard policy={policy} />,
              })),
              ...sections.planned.map((share) => ({
                key: `planned-${share.id}`,
                node: <PlannedMilestoneCard share={share} />,
              })),
            ]}
          />
        </Section>
      ) : null}
      {ready && sections.waiting.length > 0 ? (
        <Section title="Waiting for review" meta={String(sections.waiting.length)}>
          <QuietNote icon="pending">
            A reviewer decides each one. Nothing is paid or deducted automatically.
          </QuietNote>
          <Staggered items={sections.waiting.map(recordItem)} />
        </Section>
      ) : null}
      {ready && sections.decided.length > 0 ? (
        <Section title="Decided" meta={String(sections.decided.length)}>
          <Staggered items={sections.decided.map(recordItem)} />
        </Section>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  cards: { gap: SPACE.md },
});
