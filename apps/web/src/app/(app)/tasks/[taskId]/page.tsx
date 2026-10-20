import type { Metadata } from 'next';
import { TaskDetailPage } from '@/features/tasks/detail/task-detail-page';

export const metadata: Metadata = { title: 'Task' };

export default async function TaskPage({
  params,
}: {
  readonly params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <TaskDetailPage taskId={taskId} />;
}
