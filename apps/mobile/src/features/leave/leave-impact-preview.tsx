import type { LeaveImpact } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { StatusDot } from '@/components/status-pill';
import { formatDateRange } from '@/formatting/dates';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';

function Notice({ tone, text }: { readonly tone: 'critical' | 'warning'; readonly text: string }) {
  const { status } = useAppTheme();
  const colors = tone === 'critical' ? status.overdue : status.atRisk;
  return (
    <View style={styles.notice}>
      <Icon name="error" size={14} color={colors.fg} />
      <AppText variant="bodySm" color={colors.fg} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

/**
 * The server's verdict on a leave period, live as dates change: working days,
 * problems that block the request, warnings, work it touches and who else is away.
 */
export function LeaveImpactPreview({
  impact,
  updating,
}: {
  readonly impact: LeaveImpact;
  readonly updating: boolean;
}) {
  return (
    <Card tone="raised" style={[styles.card, updating ? styles.updating : null]}>
      <View style={styles.headline} accessible accessibilityLiveRegion="polite">
        <AppText variant="displayMd">{impact.durationLabel}</AppText>
        <AppText variant="bodySm" tone="secondary">
          {impact.approvalLevels > 1
            ? `Needs ${impact.approvalLevels} approvals`
            : impact.approvalLevels === 1
              ? 'Needs one approval'
              : 'No approval needed'}
        </AppText>
      </View>
      {impact.blockingProblems.map((problem) => (
        <Notice key={problem} tone="critical" text={problem} />
      ))}
      {impact.warnings.map((warning) => (
        <Notice key={warning} tone="warning" text={warning} />
      ))}
      {impact.conflicts.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="overline" tone="secondary">
            Work during this time
          </AppText>
          {impact.conflicts.map((conflict) => (
            <View key={`${conflict.taskId}-${conflict.kind}`} style={styles.conflict}>
              <View style={styles.conflictTitle}>
                <StatusDot tone={conflict.severity === 'critical' ? 'overdue' : 'atRisk'} />
                <AppText variant="body" style={styles.flex}>
                  {conflict.title}
                </AppText>
                <AppText variant="label" tone="secondary">
                  {conflict.severity === 'critical' ? 'Critical' : 'Heads-up'}
                </AppText>
              </View>
              <AppText variant="bodySm" tone="secondary">
                {conflict.projectName} · {conflict.explanation}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {impact.overlappingAbsences.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="overline" tone="secondary">
            Also away
          </AppText>
          {impact.overlappingAbsences.map((absence) => (
            <View key={absence.user.id} style={styles.person}>
              <Avatar user={absence.user} size={24} />
              <AppText variant="bodySm" style={styles.flex}>
                {absence.user.fullName}
                {absence.dates.length > 0
                  ? ` · ${formatDateRange(absence.dates[0] ?? '', absence.dates[absence.dates.length - 1] ?? '')}`
                  : ''}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md },
  updating: { opacity: 0.6 },
  headline: { gap: 2 },
  notice: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
  group: { gap: SPACE.sm },
  conflict: { gap: 2 },
  conflictTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
});
