import type { DeliverableSummary, TaskDetail } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import { StatusPill } from '@/components/status-pill';
import { useProjectDeliverables } from '@/queries/project-queries';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { deliverableStatusPresentation } from '@/theme/status-vocabulary';

export function DeliverableRow({ deliverable }: { readonly deliverable: DeliverableSummary }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const latest = deliverable.latestVersion;
  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/deliverables/[id]', params: { id: deliverable.id } })
      }
      accessibilityLabel={`${deliverable.name}, ${deliverableStatusPresentation(deliverable.status).label}`}
      accessibilityHint="Opens the deliverable to submit a version or review it"
      style={styles.row}
    >
      <View style={styles.text}>
        <AppText variant="titleMd" numberOfLines={2}>
          {deliverable.name}
          {deliverable.isRequired ? '' : ' (optional)'}
        </AppText>
        <AppText variant="bodySm" tone="secondary" numberOfLines={1}>
          {latest
            ? `Version ${latest.versionNumber} · ${latest.submittedBy.fullName}`
            : 'Nothing submitted yet'}
          {deliverable.reviewer ? ` · Reviewer ${deliverable.reviewer.fullName}` : ''}
        </AppText>
        <StatusPill status={deliverableStatusPresentation(deliverable.status)} />
      </View>
      <Icon name="chevronRight" size={14} color={colors.textTertiary} />
    </Card>
  );
}

/** Deliverables tied to this task (from the project's list). */
export function TaskDeliverablesSection({ task }: { readonly task: TaskDetail }) {
  const deliverables = useProjectDeliverables(task.project.id);
  const mine = (deliverables.data ?? []).filter((deliverable) => deliverable.task?.id === task.id);
  if (mine.length === 0) return null;
  return (
    <Section title="Deliverables" meta={String(mine.length)}>
      {mine.map((deliverable) => (
        <DeliverableRow key={deliverable.id} deliverable={deliverable} />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  text: { flex: 1, gap: SPACE.xs },
});
