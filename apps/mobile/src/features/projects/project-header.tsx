import type { ProjectDetail } from '@lintel/api-contracts';
import { PROJECT_ROLE_LABELS, PROJECT_TYPE_LABELS } from '@lintel/domain';
import { formatMoney, money } from '@lintel/shared';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { StatusPill } from '@/components/status-pill';
import { projectSwatch, useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { projectHealthPresentation } from '@/theme/status-vocabulary';

const STATUS_WORD: Readonly<Record<ProjectDetail['status'], string | null>> = {
  draft: 'Draft',
  active: null,
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

/** Identity, health and the facts people look up on site: client, address, budget. */
export function ProjectHeader({ project }: { readonly project: ProjectDetail }) {
  const theme = useAppTheme();
  const statusWord = STATUS_WORD[project.status];
  return (
    <View style={styles.header}>
      <View style={styles.reference}>
        <View
          style={[styles.swatch, { backgroundColor: projectSwatch(theme, project.colorIndex) }]}
        />
        <AppText variant="mono" tone="secondary">
          {project.reference} · {PROJECT_TYPE_LABELS[project.projectType]}
        </AppText>
      </View>
      <AppText variant="displayMd">{project.name}</AppText>
      <AppText variant="body" tone="secondary">
        {project.clientName}
        {project.siteAddress ? ` · ${project.siteAddress}` : ''}
      </AppText>
      <View style={styles.pills}>
        <StatusPill status={projectHealthPresentation(project.health.status)} size="md" />
        {statusWord ? (
          <StatusPill status={{ tone: 'neutral', icon: 'info', label: statusWord }} size="md" />
        ) : null}
        {project.criticality === 'high' || project.criticality === 'critical' ? (
          <StatusPill
            status={{
              tone: 'neutral',
              icon: 'flag',
              label: project.criticality === 'critical' ? 'Critical' : 'High priority',
            }}
            size="md"
          />
        ) : null}
      </View>
      {project.description ? <AppText variant="body">{project.description}</AppText> : null}
      <View style={styles.team} accessibilityLabel="Project team">
        {project.members.map((member) => (
          <View key={`${member.user.id}-${member.projectRole}`} style={styles.member}>
            <Avatar user={member.user} size={28} />
            <View>
              <AppText variant="bodySm">{member.user.fullName}</AppText>
              <AppText variant="label" tone="tertiary">
                {PROJECT_ROLE_LABELS[member.projectRole]}
              </AppText>
            </View>
          </View>
        ))}
      </View>
      {project.budgetMinor !== null ? (
        <AppText variant="bodySm" tone="secondary">
          Budget {formatMoney(money(project.budgetMinor, project.currency))}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACE.md },
  reference: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  team: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg },
  member: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minWidth: 140 },
});
