import type { RewardPolicy } from '@lintel/api-contracts';
import { describeRewardCriterion, REWARD_CRITERION_EXPLANATIONS } from '@lintel/domain';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Divider } from '@/components/section';
import { formatAmount } from '@/formatting/money';
import { SPACE } from '@/theme/layout';
import { BulletLine } from './reward-card-parts';

const PERIOD_WORDS: Readonly<Record<RewardPolicy['period'], string>> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const SCOPE_WORDS: Readonly<Record<RewardPolicy['scope'], string>> = {
  individual: 'Individual',
  team: 'Team',
};

/** "For you, each month" or "For the team, each quarter". */
function amountCaption(policy: RewardPolicy): string {
  const when = policy.period === 'monthly' ? 'each month' : 'each quarter';
  return policy.scope === 'team' ? `For the team, ${when}` : `For you, ${when}`;
}

/** One active policy: how often, for whom, the amount, and every criterion in words. */
export function PolicyCard({ policy }: { readonly policy: RewardPolicy }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <AppText variant="overline" tone="secondary">
          {PERIOD_WORDS[policy.period]} · {SCOPE_WORDS[policy.scope]}
        </AppText>
        <AppText variant="titleLg">{policy.name}</AppText>
        {policy.description ? (
          <AppText variant="bodySm" tone="secondary">
            {policy.description}
          </AppText>
        ) : null}
      </View>
      {policy.amountMinor > 0 ? (
        <View style={styles.amount}>
          <AppText variant="displayMd">{formatAmount(policy.amountMinor, policy.currency)}</AppText>
          <AppText variant="bodySm" tone="secondary">
            {amountCaption(policy)}
          </AppText>
        </View>
      ) : null}
      <Divider />
      <View style={styles.criteria}>
        <AppText variant="label" tone="secondary">
          {policy.criteria.length === 1 ? 'When this is met' : 'When every one of these is met'}
        </AppText>
        {policy.criteria.map((criterion) => (
          <BulletLine key={criterion.type}>
            <AppText variant="body">{describeRewardCriterion(criterion)}</AppText>
            <AppText variant="bodySm" tone="secondary">
              {REWARD_CRITERION_EXPLANATIONS[criterion.type]}
            </AppText>
          </BulletLine>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.lg },
  head: { gap: SPACE.xs },
  amount: { gap: 2 },
  criteria: { gap: SPACE.md },
});
