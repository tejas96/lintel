import { TimelineTab } from '@/features/projects/room/timeline-tab';

export default async function ProjectTimelinePage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <TimelineTab projectId={projectId} />;
}
