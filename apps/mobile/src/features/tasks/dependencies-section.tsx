import type { TaskDetail, TaskRef } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { ListRow } from '@/components/list-row';
import { Divider, Section } from '@/components/section';
import { StatusPill } from '@/components/status-pill';
import { taskStatusPresentation } from '@/theme/status-vocabulary';

function TaskRefList({
  title,
  tasks,
}: {
  readonly title: string;
  readonly tasks: readonly TaskRef[];
}) {
  const router = useRouter();
  if (tasks.length === 0) return null;
  return (
    <View>
      <AppText variant="label" tone="tertiary">
        {title}
      </AppText>
      {tasks.map((task, index) => (
        <View key={task.id}>
          {index > 0 ? <Divider /> : null}
          <ListRow
            title={task.title}
            subtitle={`#${task.number}`}
            trailing={<StatusPill status={taskStatusPresentation(task.status)} />}
            onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: task.id } })}
          />
        </View>
      ))}
    </View>
  );
}

/** What this task waits for, what waits for it, and its place in a larger task. */
export function DependenciesSection({ task }: { readonly task: TaskDetail }) {
  const total =
    task.prerequisites.length +
    task.dependents.length +
    task.subtasks.length +
    (task.parentTask ? 1 : 0);
  if (total === 0) return null;
  return (
    <Section title="Linked work">
      {task.parentTask ? <TaskRefList title="Part of" tasks={[task.parentTask]} /> : null}
      <TaskRefList title="Waits for" tasks={task.prerequisites} />
      <TaskRefList title="Needed by" tasks={task.dependents} />
      <TaskRefList title="Subtasks" tasks={task.subtasks} />
    </Section>
  );
}
