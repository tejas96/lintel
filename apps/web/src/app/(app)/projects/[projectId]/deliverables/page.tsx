import { DeliverablesTab } from '@/features/projects/room/deliverables-tab';

export default async function ProjectDeliverablesPage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DeliverablesTab projectId={projectId} />;
}
