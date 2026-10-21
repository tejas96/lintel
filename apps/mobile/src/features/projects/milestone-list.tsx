import type { Milestone, Stage } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Divider, Section } from '@/components/section';
import { StatusPill } from '@/components/status-pill';
import { formatShortDate, withLongDates } from '@/formatting/dates';
import { pluralize } from '@/formatting/quantities';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { milestoneHealthPresentation } from '@/theme/status-vocabulary';

function MilestoneRow({
  milestone,
  stageName,
}: {
  readonly milestone: Milestone;
  readonly stageName: string | null;
}) {
  const { status } = useAppTheme();
  const moved = milestone.baselineDueDate !== milestone.dueDate;
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <AppText variant="titleMd" style={styles.flex}>
          {milestone.name}
        </AppText>
        <StatusPill status={milestoneHealthPresentation(milestone.health)} />
      </View>
      <AppText variant="bodySm" tone="secondary">
        {formatShortDate(milestone.dueDate)}
        {moved ? ` (was ${formatShortDate(milestone.baselineDueDate)})` : ''}
        {stageName ? ` · ${stageName}` : ''}
        {milestone.status === 'pending' && milestone.openTaskCount > 0
          ? ` · ${pluralize(milestone.openTaskCount, 'open task')}`
          : ''}
      </AppText>
      {milestone.requiresClientApproval ? (
        <AppText variant="label" tone="tertiary">
          Needs client approval
        </AppText>
      ) : null}
      {milestone.riskReasons.map((reason) => (
        <AppText key={reason} variant="bodySm" color={status.atRisk.fg}>
          {withLongDates(reason)}
        </AppText>
      ))}
    </View>
  );
}

/** Milestones in date order with the server's health and risk reasons. */
export function MilestoneList({
  milestones,
  stages,
}: {
  readonly milestones: readonly Milestone[];
  readonly stages: readonly Stage[];
}) {
  if (milestones.length === 0) return null;
  const ordered = [...milestones].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const done = ordered.filter((milestone) => milestone.status === 'completed').length;
  return (
    <Section title="Milestones" meta={`${done}/${ordered.length}`}>
      <Card style={styles.card}>
        {ordered.map((milestone, index) => (
          <View key={milestone.id}>
            {index > 0 ? <Divider /> : null}
            <MilestoneRow
              milestone={milestone}
              stageName={stages.find((stage) => stage.id === milestone.stageId)?.name ?? null}
            />
          </View>
        ))}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: SPACE.xs },
  row: { gap: SPACE.xs, paddingVertical: SPACE.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});
