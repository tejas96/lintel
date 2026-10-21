import type { DateChangeRequest } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { HighlightRing } from '@/components/highlight-ring';
import { Icon } from '@/components/icon';
import { StatusPill } from '@/components/status-pill';
import { formatRelativeInstant, formatShortDate } from '@/formatting/dates';
import { useAppTheme } from '@/theme/app-theme';
import { fontFaceFor } from '@/theme/fonts';
import { RADIUS, SPACE } from '@/theme/layout';
import type { StatusPresentation } from '@/theme/status-vocabulary';
import { DateChangeDecisionPanel, WithdrawDateChangeButton } from './date-change-decision';

const STATUS: Readonly<Record<DateChangeRequest['status'], StatusPresentation>> = {
  open: { tone: 'review', icon: 'pending', label: 'Waiting for a decision' },
  accepted: { tone: 'done', icon: 'done', label: 'New date set' },
  declined: { tone: 'neutral', icon: 'close', label: 'Declined' },
  withdrawn: { tone: 'neutral', icon: 'close', label: 'Withdrawn' },
};

/** "Sun, 26 Oct → Thu, 30 Oct": the old date struck through, the asked-for date strong. */
function DateMove({
  label,
  from,
  to,
}: {
  readonly label: string;
  readonly from: string | null;
  readonly to: string;
}) {
  const { colors } = useAppTheme();
  const spokenFrom = from ? formatShortDate(from) : 'not set';
  return (
    <View
      style={styles.move}
      accessible
      accessibilityLabel={`${label}: from ${spokenFrom} to ${formatShortDate(to)}`}
    >
      <AppText variant="label" tone="tertiary" style={styles.moveLabel}>
        {label}
      </AppText>
      <AppText
        variant="mono"
        tone={from ? 'secondary' : 'tertiary'}
        style={from ? styles.struck : null}
      >
        {spokenFrom}
      </AppText>
      <Icon name="arrowRight" size={12} color={colors.textTertiary} />
      <AppText variant="mono" style={styles.strong}>
        {formatShortDate(to)}
      </AppText>
    </View>
  );
}

/** One request: what it asks for, why, who asked, and what was decided. */
export function DateChangeRequestCard({
  request,
  highlighted = false,
}: {
  readonly request: DateChangeRequest;
  /** Opened from a link about this request (approvals, a notification). */
  readonly highlighted?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <HighlightRing active={highlighted}>
      <Card tone="raised" style={styles.card}>
        <StatusPill status={STATUS[request.status]} />
        <View style={styles.moves}>
          <DateMove label="Due" from={request.previousDueDate} to={request.proposedDueDate} />
          {request.proposedStartDate ? (
            <DateMove
              label="Start"
              from={request.previousStartDate}
              to={request.proposedStartDate}
            />
          ) : null}
        </View>
        <View style={[styles.quote, { borderLeftColor: colors.borderStrong }]}>
          <AppText variant="body">{request.reason}</AppText>
        </View>
        <View style={styles.byline}>
          <Avatar user={request.requestedBy} size={22} />
          <AppText variant="bodySm" tone="secondary" style={styles.flex} numberOfLines={1}>
            {request.requestedBy.fullName} · {formatRelativeInstant(request.createdAt)}
          </AppText>
        </View>
        {request.decisionNote ? (
          <View style={[styles.note, { backgroundColor: colors.surfaceSunken }]}>
            <AppText variant="label" tone="secondary">
              {request.decidedBy?.fullName ?? 'Decision'}
            </AppText>
            <AppText variant="bodySm">“{request.decisionNote}”</AppText>
          </View>
        ) : null}
        {request.viewerCanDecide ? <DateChangeDecisionPanel request={request} /> : null}
        {request.viewerCanWithdraw ? <WithdrawDateChangeButton request={request} /> : null}
      </Card>
    </HighlightRing>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md },
  moves: { gap: SPACE.xs },
  move: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  moveLabel: { width: 44 },
  struck: { textDecorationLine: 'line-through' },
  strong: { fontFamily: fontFaceFor('mono', 500) },
  quote: { borderLeftWidth: 2, paddingLeft: SPACE.md },
  byline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
  note: { borderRadius: RADIUS.md, padding: SPACE.md, gap: 2 },
});
