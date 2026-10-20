import { ActivityTab } from '@/features/projects/room/activity-tab';

export default async function ProjectActivityPage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ActivityTab projectId={projectId} />;
}
