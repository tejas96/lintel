import { TaskDrawer } from '@/features/tasks/detail/task-drawer';

/** Intercepts task links opened from inside the app and shows them in a drawer. */
export default async function TaskDrawerPage({
  params,
}: {
  readonly params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <TaskDrawer key={taskId} taskId={taskId} />;
}
