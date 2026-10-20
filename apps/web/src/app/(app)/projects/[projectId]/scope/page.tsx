import { ScopeTab } from '@/features/projects/room/scope-tab';

export default async function ProjectScopePage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ScopeTab projectId={projectId} />;
}
