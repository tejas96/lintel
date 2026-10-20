import type { ReactNode } from 'react';
import { ProjectRoom } from '@/features/projects/room/project-room';

export default async function ProjectLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectRoom projectId={projectId}>{children}</ProjectRoom>;
}
