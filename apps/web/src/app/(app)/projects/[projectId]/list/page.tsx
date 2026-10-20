import { ListTab } from '@/features/projects/room/list-tab';

export default async function ProjectListPage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ListTab projectId={projectId} />;
}
