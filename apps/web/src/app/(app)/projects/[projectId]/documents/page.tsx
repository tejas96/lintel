import { DocumentsTab } from '@/features/projects/documents/documents-tab';

export default async function ProjectDocumentsPage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DocumentsTab projectId={projectId} />;
}
