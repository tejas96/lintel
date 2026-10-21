import type { TaskSummary } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { StatusPill } from '@/components/status-pill';
import { taskDueLabel } from '@/formatting/dates';
import { projectSwatch, useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { OVERDUE_PRESENTATION, taskStatusPresentation } from '@/theme/status-vocabulary';

/** "LIN-012 · Concept" — the project reference keeps its identity colour. */
export function TaskContextLine({ task }: { readonly task: TaskSummary }) {
  const theme = useAppTheme();
  return (
    <View style={styles.context}>
      <View
        style={[styles.swatch, { backgroundColor: projectSwatch(theme, task.project.colorIndex) }]}
      />
      <AppText variant="mono" tone="secondary" numberOfLines={1} style={styles.shrink}>
        {task.project.reference}
        {task.stage ? ` · ${task.stage.name}` : ''}
        {` · #${task.number}`}
      </AppText>
    </View>
  );
}

/** Status pill, due date (and time) and checklist progress, wrapped onto as many lines as needed. */
export function TaskFacts({ task, today }: { readonly task: TaskSummary; readonly today: string }) {
  const { colors, status } = useAppTheme();
  const due = taskDueLabel(task, today);
  const dueColor = due.late ? status.overdue.fg : colors.textSecondary;
  return (
    <View style={styles.facts}>
      <StatusPill status={taskStatusPresentation(task.status)} />
      {task.isOverdue ? <StatusPill status={OVERDUE_PRESENTATION} /> : null}
      <View style={[styles.fact, styles.shrink]}>
        <Icon name="calendar" size={13} color={dueColor} />
        <AppText variant="label" color={dueColor} numberOfLines={1} style={styles.shrink}>
          {due.text}
        </AppText>
      </View>
      {task.checklist.total > 0 ? (
        <View
          style={styles.fact}
          accessible
          accessibilityLabel={`Checklist ${task.checklist.done} of ${task.checklist.total} done`}
        >
          <Icon name="checklist" size={13} color={colors.textSecondary} />
          <AppText variant="mono" tone="secondary">
            {task.checklist.done}/{task.checklist.total}
          </AppText>
        </View>
      ) : null}
      {task.needsAcknowledgement ? (
        <View style={[styles.newBadge, { backgroundColor: colors.accentSoft }]}>
          <AppText variant="label" color={colors.onAccentSoft}>
            New for you
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  context: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  shrink: { flexShrink: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  newBadge: { paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: 999 },
});
