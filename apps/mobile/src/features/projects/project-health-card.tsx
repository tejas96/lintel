import type { ProjectDetail } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { formatShortDate, withReadableDates } from '@/formatting/dates';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';

function Figure({
  value,
  label,
  color,
}: {
  readonly value: number;
  readonly label: string;
  readonly color?: string;
}) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText variant="displayMd" {...(color ? { color } : {})}>
        {value}
      </AppText>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

/** Editorial numerals for the work, the server's reasons for the health verdict, and the forecast. */
export function ProjectHealthCard({ project }: { readonly project: ProjectDetail }) {
  const { status } = useAppTheme();
  const { health } = project;
  const slipping =
    health.forecastEndDate !== null && health.forecastEndDate > project.plannedEndDate;
  return (
    <Card style={styles.card}>
      <View style={styles.figures}>
        <Figure value={health.openTaskCount} label="Open" />
        <Figure
          value={health.overdueTaskCount}
          label="Overdue"
          {...(health.overdueTaskCount > 0 ? { color: status.overdue.fg } : {})}
        />
        <Figure
          value={health.blockedTaskCount}
          label="Blocked"
          {...(health.blockedTaskCount > 0 ? { color: status.blocked.fg } : {})}
        />
        <Figure value={health.completedTaskCount} label="Done" />
      </View>
      {health.reasons.map((reason) => {
        const tone = reason.severity === 'critical' ? status.overdue : status.atRisk;
        return (
          <View key={reason.message} style={styles.reason}>
            <Icon name="error" size={14} color={tone.fg} />
            <AppText variant="bodySm" color={tone.fg} style={styles.flex}>
              {withReadableDates(reason.message)}
            </AppText>
          </View>
        );
      })}
      <AppText variant="bodySm" tone="secondary">
        Planned to finish {formatShortDate(project.plannedEndDate)}
        {health.forecastEndDate && health.forecastEndDate !== project.plannedEndDate
          ? ` · forecast ${formatShortDate(health.forecastEndDate)}`
          : ''}
        {project.baselineEndDate !== project.plannedEndDate
          ? ` · originally ${formatShortDate(project.baselineEndDate)}`
          : ''}
      </AppText>
      {slipping ? (
        <AppText variant="label" color={status.atRisk.fg}>
          The forecast is later than the plan.
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md },
  figures: { flexDirection: 'row', justifyContent: 'space-between' },
  figure: { alignItems: 'flex-start', minWidth: 60 },
  reason: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
