import type { Metadata } from 'next';
import { NewProjectWizard } from '@/features/projects/new/new-project-wizard';

export const metadata: Metadata = { title: 'New project' };

export default function NewProjectPage() {
  return <NewProjectWizard />;
}
