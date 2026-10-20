import { BoardTab } from '@/features/projects/room/board-tab';

export default async function ProjectBoardPage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <BoardTab projectId={projectId} />;
}
