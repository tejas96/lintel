import type { TaskDetail, UserSummary } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Avatar, AvatarStack } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { StatusPill } from '@/components/status-pill';
import { useToast } from '@/feedback/toast';
import { dueLabel, formatShortDate } from '@/formatting/dates';
import { useAcknowledgeTask } from '@/queries/task-queries';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { OVERDUE_PRESENTATION, taskStatusPresentation } from '@/theme/status-vocabulary';
import { TaskContextLine } from './task-meta';

const PRIORITY_LABELS: Readonly<Record<TaskDetail['priority'], string>> = {
  low: 'Low priority',
  medium: 'Medium priority',
  high: 'High priority',
  urgent: 'Urgent',
};

function Person({ title, user }: { readonly title: string; readonly user: UserSummary }) {
  return (
    <View style={styles.person}>
      <Avatar user={user} size={28} />
      <View>
        <AppText variant="label" tone="tertiary">
          {title}
        </AppText>
        <AppText variant="bodySm">{user.fullName}</AppText>
      </View>
    </View>
  );
}

function Fact({
  label,
  value,
  color,
}: {
  readonly label: string;
  readonly value: string;
  readonly color?: string;
}) {
  return (
    <View style={styles.fact}>
      <AppText variant="label" tone="tertiary">
        {label}
      </AppText>
      <AppText variant="bodySm" {...(color ? { color } : {})}>
        {value}
      </AppText>
    </View>
  );
}

/** Title, status vocabulary, people and dates; an acknowledgement prompt for new assignments. */
export function TaskHeader({ task, today }: { readonly task: TaskDetail; readonly today: string }) {
  const { status, colors } = useAppTheme();
  const toast = useToast();
  const acknowledge = useAcknowledgeTask(task.id);
  const moved = task.baselineDueDate && task.dueDate && task.baselineDueDate !== task.dueDate;
  return (
    <View style={styles.header}>
      <TaskContextLine task={task} />
      <AppText variant="displayMd">{task.title}</AppText>
      <View style={styles.pills}>
        <StatusPill status={taskStatusPresentation(task.status)} size="md" />
        {task.isOverdue ? <StatusPill status={OVERDUE_PRESENTATION} size="md" /> : null}
        {task.priority === 'high' || task.priority === 'urgent' ? (
          <StatusPill
            status={{ tone: 'neutral', icon: 'flag', label: PRIORITY_LABELS[task.priority] }}
            size="md"
          />
        ) : null}
      </View>
      {task.needsAcknowledgement ? (
        <Card tone="accentSoft" style={styles.ack}>
          <AppText variant="bodySm" color={colors.onAccentSoft} style={styles.flex}>
            This was just assigned to you. Let the team know you’ve seen it.
          </AppText>
          <Button
            label="Got it"
            loading={acknowledge.isPending}
            onPress={() =>
              acknowledge.mutate(undefined, {
                onError: (error) => toast.show(errorMessage(error), 'error'),
              })
            }
          />
        </Card>
      ) : null}
      <View style={styles.people}>
        {task.owner ? (
          <Person title="Owner" user={task.owner} />
        ) : (
          <Fact label="Owner" value="Not assigned" />
        )}
        {task.reviewer ? <Person title="Reviewer" user={task.reviewer} /> : null}
        {task.collaborators.length > 0 ? (
          <View style={styles.person}>
            <AvatarStack users={task.collaborators} />
            <AppText variant="label" tone="tertiary">
              Helping
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.facts}>
        <Fact
          label="Due"
          value={
            task.dueDate
              ? `${formatShortDate(task.dueDate)} · ${dueLabel(task.dueDate, today)}`
              : 'No due date'
          }
          {...(task.isOverdue ? { color: status.overdue.fg } : {})}
        />
        {moved && task.baselineDueDate ? (
          <Fact label="Originally" value={formatShortDate(task.baselineDueDate)} />
        ) : null}
        {task.milestone ? <Fact label="Milestone" value={task.milestone.name} /> : null}
      </View>
      {task.description ? <AppText variant="body">{task.description}</AppText> : null}
      {task.completionCriteria ? (
        <Card tone="sunken" style={styles.criteria}>
          <AppText variant="label" tone="secondary">
            Done means
          </AppText>
          <AppText variant="bodySm">{task.completionCriteria}</AppText>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACE.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  ack: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flex: { flex: 1 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xl },
  fact: { gap: 2 },
  criteria: { gap: SPACE.xs },
});
