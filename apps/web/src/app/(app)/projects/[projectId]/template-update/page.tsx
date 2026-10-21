import { TemplateUpdateView } from '@/features/projects/template-update/template-update-view';

export default async function ProjectTemplateUpdatePage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <TemplateUpdateView projectId={projectId} />;
}
