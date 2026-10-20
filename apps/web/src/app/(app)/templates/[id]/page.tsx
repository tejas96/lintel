import type { Metadata } from 'next';
import { TemplateEditorPage } from '@/features/templates/editor/template-editor-page';

export const metadata: Metadata = { title: 'Edit template' };

export default async function TemplatePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateEditorPage templateId={id} />;
}
