import { redirect } from 'next/navigation';
import { OverviewTab } from '@/features/projects/room/overview-tab';

const TAB_SEGMENTS = new Set(['board', 'timeline', 'list', 'deliverables', 'scope', 'activity']);

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ projectId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;
  // Links from notifications and approvals use ?tab=…; each tab has its own URL here.
  if (typeof tab === 'string' && TAB_SEGMENTS.has(tab)) redirect(`/projects/${projectId}/${tab}`);
  return <OverviewTab projectId={projectId} />;
}
