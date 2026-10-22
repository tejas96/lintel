import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { formatInstant } from '@/formatting/dates';
import { formatAmount } from '@/formatting/money';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { payableAmount, type RewardRecord } from './reward-records';

/** The equal-split line, only while the amount still is the equal split. */
function shareWords(record: RewardRecord): string | null {
  if (record.sharedBy <= 1) return null;
  return record.adjustedAmountMinor === null ||
    record.adjustedAmountMinor === record.proposedAmountMinor
    ? `Your share, split equally by ${record.sharedBy} people.`
    : `From a reward shared by ${record.sharedBy} people.`;
}

/** "Adjusted from ₹2,500.01: the reason." when a reviewer changed the amount. */
function adjustmentWords(record: RewardRecord): string | null {
  if (record.adjustedAmountMinor === null || record.proposedAmountMinor === null) return null;
  const from = `Adjusted from ${formatAmount(record.proposedAmountMinor, record.currency)}`;
  const reason = record.adjustmentReason;
  return reason && reason !== record.decisionNote ? `${from}: ${reason}` : `${from}.`;
}

/**
 * The amount, only when the API returned it: what was granted (approved) or
 * what a reviewer would grant (waiting). Nothing for records not granted.
 */
export function RecordAmount({ record }: { readonly record: RewardRecord }) {
  const amount = payableAmount(record);
  const shown = record.status === 'approved' || record.status === 'pending_review';
  if (!shown || amount === null) return null;
  const lines = [
    record.status === 'pending_review' ? 'If a reviewer approves it.' : null,
    shareWords(record),
    record.status === 'approved' ? adjustmentWords(record) : null,
  ].filter((line): line is string => line !== null);
  return (
    <View style={styles.amountRow}>
      <View style={styles.amount}>
        <AppText variant="displayMd">{formatAmount(amount, record.currency)}</AppText>
        {lines.map((line) => (
          <AppText key={line} variant="bodySm" tone="secondary">
            {line}
          </AppText>
        ))}
      </View>
      {record.status === 'approved' ? <RewardSeal /> : null}
    </View>
  );
}

/** A quiet rosette beside a granted amount; decorative (the pill says "Approved"). */
function RewardSeal() {
  const { status } = useAppTheme();
  return (
    <View
      style={[styles.seal, { backgroundColor: status.onTrack.tint }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="reward" size={26} color={status.onTrack.fg} />
    </View>
  );
}

const DECISION_VERB: Readonly<Partial<Record<RewardRecord['status'], string>>> = {
  approved: 'approved this',
  rejected: 'did not approve this',
};

/** Who decided and when, with their note; or why a record was never decided. */
export function DecisionLine({ record }: { readonly record: RewardRecord }) {
  if (record.status === 'withdrawn') {
    return (
      <AppText variant="bodySm" tone="secondary">
        The planner withdrew this reward before the milestone was completed.
      </AppText>
    );
  }
  const verb = DECISION_VERB[record.status];
  if (!record.decidedBy || !verb) return null;
  return (
    <View style={styles.decision}>
      <Avatar user={record.decidedBy} size={28} />
      <View style={styles.flex}>
        <AppText variant="bodySm">
          {record.decidedBy.fullName} {verb}
        </AppText>
        {record.decidedAt ? (
          <AppText variant="mono" tone="tertiary">
            {formatInstant(record.decidedAt)}
          </AppText>
        ) : null}
        {record.decisionNote ? (
          <AppText variant="bodySm" style={styles.note}>
            “{record.decisionNote}”
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  amount: { flex: 1, gap: 2 },
  seal: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decision: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  flex: { flex: 1, gap: 2 },
  note: { marginTop: SPACE.xs },
});
