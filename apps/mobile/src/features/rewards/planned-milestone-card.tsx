import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Divider } from '@/components/section';
import { formatShortDate } from '@/formatting/dates';
import { formatAmount } from '@/formatting/money';
import { SPACE } from '@/theme/layout';
import { BulletLine, ProjectLine } from './reward-card-parts';
import type { PlannedShare } from './reward-records';

/** "For you, …" or "Your share. Shared equally by 2 people, ₹5,000.01 in all." */
function shareCaption(share: PlannedShare): string {
  if (share.sharedBy <= 1) return 'For you, when every condition below is met.';
  const total =
    share.totalAmountMinor === null
      ? ''
      : `, ${formatAmount(share.totalAmountMinor, share.currency)} in all`;
  return `Your share. Shared equally by ${share.sharedBy} people${total}.`;
}

/**
 * A milestone reward still ahead: the project and milestone, the agreed date,
 * the person's share, the conditions that earn it and the planner's note.
 */
export function PlannedMilestoneCard({ share }: { readonly share: PlannedShare }) {
  const caption = shareCaption(share);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <ProjectLine
          colorIndex={share.project.colorIndex}
          text={`${share.project.reference} · ${share.project.name}`}
        />
        <AppText variant="titleLg">{share.milestone.name}</AppText>
        <AppText variant="bodySm" tone="secondary">
          Milestone reward · agreed date {formatShortDate(share.agreedDueDate)}
        </AppText>
      </View>
      <View style={styles.amount}>
        {share.shareAmountMinor !== null ? (
          <AppText variant="displayMd">
            {formatAmount(share.shareAmountMinor, share.currency)}
          </AppText>
        ) : null}
        <AppText variant="bodySm" tone="secondary">
          {caption}
        </AppText>
      </View>
      <Divider />
      <View style={styles.conditions}>
        <AppText variant="label" tone="secondary">
          What earns it
        </AppText>
        {share.conditions.map((condition) => (
          <BulletLine key={condition}>
            <AppText variant="body">{condition}</AppText>
          </BulletLine>
        ))}
      </View>
      {share.note ? (
        <Card tone="sunken" style={styles.note}>
          <AppText variant="label" tone="secondary">
            Note from the planner
          </AppText>
          <AppText variant="bodySm">“{share.note}”</AppText>
        </Card>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.lg },
  head: { gap: SPACE.xs },
  amount: { gap: 2 },
  conditions: { gap: SPACE.md },
  note: { gap: SPACE.xs },
});
