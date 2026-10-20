import { OverviewTab } from '@/features/projects/room/overview-tab';

export default async function ProjectOverviewPage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <OverviewTab projectId={projectId} />;
}
