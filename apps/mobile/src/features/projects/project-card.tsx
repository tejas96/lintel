import type { ProjectSummary } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressBar } from '@/components/progress-bar';
import { StatusPill } from '@/components/status-pill';
import { formatShortDate } from '@/formatting/dates';
import { projectSwatch, useAppTheme } from '@/theme/app-theme';
import { HAIRLINE, RADIUS, SPACE } from '@/theme/layout';
import { projectHealthPresentation } from '@/theme/status-vocabulary';

/** One project: identity, health, where it is in its workflow and what's next. */
export function ProjectCard({ project }: { readonly project: ProjectSummary }) {
  const router = useRouter();
  const theme = useAppTheme();
  const { colors } = theme;
  const health = projectHealthPresentation(project.health.status);
  const total = project.health.openTaskCount + project.health.completedTaskCount;
  const done = total > 0 ? project.health.completedTaskCount / total : 0;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${project.clientName}, ${health.label}`}
      onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}
      pressedScale={0.985}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
    >
      <View style={[styles.rail, { backgroundColor: projectSwatch(theme, project.colorIndex) }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <AppText variant="mono" tone="secondary">
            {project.reference}
          </AppText>
          <StatusPill status={health} />
        </View>
        <AppText variant="titleLg" numberOfLines={2}>
          {project.name}
        </AppText>
        <AppText variant="bodySm" tone="secondary" numberOfLines={1}>
          {project.clientName}
        </AppText>
        {project.currentStage ? (
          <AppText variant="bodySm">
            Stage {project.currentStage.position} of {project.currentStage.totalStages} ·{' '}
            {project.currentStage.name}
          </AppText>
        ) : null}
        <ProgressBar
          value={done}
          height={4}
          color={theme.status.onTrack.solid}
          accessibilityLabel={`${project.health.completedTaskCount} of ${total} tasks done`}
        />
        <View style={styles.bottomRow}>
          <AppText variant="bodySm" tone="secondary" style={styles.flex} numberOfLines={1}>
            {project.nextMilestone
              ? `Next: ${project.nextMilestone.name} · ${formatShortDate(project.nextMilestone.dueDate)}`
              : `Ends ${formatShortDate(project.plannedEndDate)}`}
          </AppText>
          <Avatar user={project.manager} size={24} />
        </View>
        {project.health.overdueTaskCount + project.health.blockedTaskCount > 0 ? (
          <AppText variant="label" color={theme.status.atRisk.fg}>
            {[
              project.health.overdueTaskCount > 0 ? `${project.health.overdueTaskCount} overdue` : null,
              project.health.blockedTaskCount > 0 ? `${project.health.blockedTaskCount} blocked` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: HAIRLINE,
    overflow: 'hidden',
  },
  rail: { width: 4 },
  body: { flex: 1, padding: SPACE.lg, gap: SPACE.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});
