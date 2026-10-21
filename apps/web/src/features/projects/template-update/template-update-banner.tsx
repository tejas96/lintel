'use client';

import { Button } from '@lintel/design-system/web';
import { ArrowRight, GitCompareArrows } from 'lucide-react';
import Link from 'next/link';
import { useTemplateUpdateStatus } from './use-template-update';

/**
 * Tells a project manager that the template this project follows has a newer
 * published version, and leads to the preview. Nothing changes until they apply it.
 */
export function TemplateUpdateBanner({ projectId }: { readonly projectId: string }) {
  const status = useTemplateUpdateStatus(projectId);
  const data = status.data;
  if (!data?.available || !data.viewerCanUpdate || !data.template || !data.current) return null;
  return (
    <section
      aria-label="Template update available"
      className="flex flex-col gap-3 rounded-lg border border-accent/25 bg-accent-soft/40 p-4 sm:flex-row sm:items-center sm:gap-4"
    >
      <GitCompareArrows aria-hidden className="hidden size-5 shrink-0 text-accent sm:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="type-body-sm font-medium text-ink">
          “{data.template.name}” version {data.available.versionNumber} is published
        </p>
        <p className="type-body-sm text-ink-muted">
          This project follows version {data.current.versionNumber}.{' '}
          {data.available.changeNotes ?? 'See what would change before deciding.'}
        </p>
      </div>
      <Button asChild variant="primary" size="sm" className="self-start sm:self-auto">
        <Link href={`/projects/${projectId}/template-update`}>
          Review the update
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Button>
    </section>
  );
}
