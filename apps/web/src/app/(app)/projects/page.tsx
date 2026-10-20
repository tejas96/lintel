import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProjectsView } from '@/features/projects/projects-view';

export const metadata: Metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsView />
    </Suspense>
  );
}
