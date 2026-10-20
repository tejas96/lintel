import type { TaskSummary } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Section } from '@/components/section';
import { TaskContextLine, TaskFacts } from '@/features/tasks/task-meta';
import { SPACE } from '@/theme/layout';

/** Tasks someone submitted for this person's review (they can be anyone's reviewer). */
export function ReviewsWaiting({
  tasks,
  today,
}: {
  readonly tasks: readonly TaskSummary[];
  readonly today: string;
}) {
  const router = useRouter();
  if (tasks.length === 0) return null;
  return (
    <Section title="Waiting for your review" meta={String(tasks.length)}>
      <View style={{ gap: SPACE.md }}>
        {tasks.map((task) => (
          <Card
            key={task.id}
            onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: task.id } })}
            accessibilityLabel={`Review ${task.title}`}
            style={{ gap: SPACE.sm }}
          >
            <TaskContextLine task={task} />
            <AppText variant="titleMd" numberOfLines={2}>
              {task.title}
            </AppText>
            {task.owner ? (
              <AppText variant="bodySm" tone="secondary">
                Submitted by {task.owner.fullName}
              </AppText>
            ) : null}
            <TaskFacts task={task} today={today} />
          </Card>
        ))}
      </View>
    </Section>
  );
}
