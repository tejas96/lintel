import type { Stage } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { formatDateRange } from '@/formatting/dates';
import { type AppTheme, useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { StageTracker } from './stage-tracker';

/** Same colours as the tracker above: done, current ("now"), still to come. */
function stageDotColor(theme: AppTheme, status: Stage['status']): string {
  if (status === 'completed') return theme.status.onTrack.solid;
  if (status === 'active') return theme.colors.accent;
  return theme.colors.borderStrong;
}

const STAGE_WORD: Readonly<Record<Stage['status'], string>> = {
  completed: 'Done',
  active: 'Current',
  pending: 'Upcoming',
  skipped: 'Skipped',
};

/** The segmented tracker, then each stage with its dates and task progress. */
export function StageList({ stages }: { readonly stages: readonly Stage[] }) {
  const theme = useAppTheme();
  if (stages.length === 0) return null;
  const ordered = [...stages].sort((left, right) => left.position - right.position);
  return (
    <Card style={styles.card}>
      <StageTracker stages={ordered} />
      <View style={styles.list}>
        {ordered.map((stage) => (
          <View
            key={stage.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${stage.name}: ${STAGE_WORD[stage.status]}, ${stage.taskCounts.done} of ${stage.taskCounts.total} tasks done`}
          >
            <View style={[styles.dot, { backgroundColor: stageDotColor(theme, stage.status) }]} />
            <View style={styles.flex}>
              <AppText variant="body" tone={stage.status === 'skipped' ? 'tertiary' : 'primary'}>
                {stage.name}
              </AppText>
              <AppText variant="bodySm" tone="secondary">
                {STAGE_WORD[stage.status]}
                {stage.plannedStartDate && stage.plannedEndDate
                  ? ` · ${formatDateRange(stage.plannedStartDate, stage.plannedEndDate)}`
                  : ''}
                {stage.taskCounts.blocked > 0 ? ` · ${stage.taskCounts.blocked} blocked` : ''}
              </AppText>
            </View>
            <AppText variant="mono" tone="secondary">
              {stage.taskCounts.done}/{stage.taskCounts.total}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.lg },
  list: { gap: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
