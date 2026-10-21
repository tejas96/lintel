'use client';

import type { TemplateUpdatePreview } from '@lintel/api-contracts';
import { Button, Card } from '@lintel/design-system/web';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChangeMark } from './change-mark';
import { bucketOf } from './update-sections';

export interface UpdateCounts {
  readonly applies: number;
  readonly held: number;
  readonly blocked: number;
  readonly byKind: Readonly<Record<'added' | 'changed' | 'removed' | 'unchanged', number>>;
}

export function countUpdate(preview: TemplateUpdatePreview): UpdateCounts {
  const byKind = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const item of preview.items) byKind[bucketOf(item)] += 1;
  return {
    applies: preview.items.filter((item) => item.willApply).length,
    held: preview.items.filter((item) => !item.blocked && !item.willApply).length,
    blocked: preview.items.filter((item) => item.blocked).length,
    byKind,
  };
}

/** The decision: how much applies, how much is held back, and the button that applies it. */
export function ApplyPanel({
  projectId,
  preview,
  counts,
  pending,
  onApply,
  children,
}: {
  readonly children?: ReactNode;
  readonly projectId: string;
  readonly preview: TemplateUpdatePreview;
  readonly counts: UpdateCounts;
  readonly pending: boolean;
  readonly onApply: () => void;
}) {
  const { unchanged } = preview;
  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="type-title-md text-ink">Summary</h2>
      <dl className="grid grid-cols-2 gap-2">
        {(['added', 'changed', 'removed', 'unchanged'] as const).map((kind) => (
          <div key={kind} className="flex flex-col gap-1 rounded-md bg-sunken/60 px-3 py-2">
            <dt>
              <ChangeMark kind={kind} />
            </dt>
            <dd className="type-display-md text-ink tabular-nums">{counts.byKind[kind]}</dd>
          </div>
        ))}
      </dl>
      <p className="type-body-sm text-ink-muted">
        {counts.applies} {counts.applies === 1 ? 'change applies' : 'changes apply'}
        {counts.held > 0 && `, ${counts.held} held back until you tick them`}. Already the same:{' '}
        {unchanged.stages} {unchanged.stages === 1 ? 'stage' : 'stages'}, {unchanged.milestones}{' '}
        {unchanged.milestones === 1 ? 'milestone' : 'milestones'} and {unchanged.tasks}{' '}
        {unchanged.tasks === 1 ? 'task' : 'tasks'}.
      </p>
      {children}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" pending={pending} onClick={onApply} className="flex-1">
          Apply update to version {preview.to.versionNumber}
        </Button>
        <Button asChild variant="quiet">
          <Link href={`/projects/${projectId}`}>Not now</Link>
        </Button>
      </div>
    </Card>
  );
}
