import type { Stage } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { StatusDot } from '@/components/status-pill';
import { formatDateRange } from '@/formatting/dates';
import { SPACE } from '@/theme/layout';
import type { StatusPresentation } from '@/theme/status-vocabulary';
import { StageTracker } from './stage-tracker';

const STAGE_TONE: Readonly<Record<Stage['status'], StatusPresentation['tone']>> = {
  completed: 'done',
  active: 'onTrack',
  pending: 'neutral',
  skipped: 'neutral',
};

const STAGE_WORD: Readonly<Record<Stage['status'], string>> = {
  completed: 'Done',
  active: 'Current',
  pending: 'Upcoming',
  skipped: 'Skipped',
};

/** The segmented tracker, then each stage with its dates and task progress. */
export function StageList({ stages }: { readonly stages: readonly Stage[] }) {
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
            <StatusDot tone={STAGE_TONE[stage.status]} />
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
});
