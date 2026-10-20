'use client';

import type { TemplateDetail } from '@lintel/api-contracts';
import { Badge, Button } from '@lintel/design-system/web';
import { PROJECT_TYPE_LABELS } from '@lintel/domain';
import { Archive, ChevronLeft, History, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { draftOf } from '../template-types';

interface EditorHeaderProps {
  readonly detail: TemplateDetail;
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly readOnly: boolean;
  /** Someone else saved first; nothing can be saved until the latest is loaded. */
  readonly stale: boolean;
  readonly onSave: () => void;
  readonly onPublish: () => void;
  readonly onHistory: () => void;
  readonly onArchive: () => void;
}

/** One sentence on which version is being edited and what it is based on. */
function describeSituation(detail: TemplateDetail, readOnly: boolean): string {
  const draft = draftOf(detail);
  const published = detail.publishedVersion;
  if (readOnly) return 'Archived. New projects can no longer start from it.';
  if (draft) {
    const basis = published ? `, based on version ${published.versionNumber} in use today` : '';
    return `Draft of version ${draft.versionNumber}${basis}.`;
  }
  if (published) {
    return `Version ${published.versionNumber} is in use. Your first change starts a new draft.`;
  }
  return 'Not published yet.';
}

/** Which version is being shaped, whether it is saved, and what can be done with it. */
export function EditorHeader({
  detail,
  dirty,
  saving,
  readOnly,
  stale,
  onSave,
  onPublish,
  onHistory,
  onArchive,
}: EditorHeaderProps) {
  const draft = draftOf(detail);
  const published = detail.publishedVersion;
  const situation = describeSituation(detail, readOnly);
  return (
    <header className="flex flex-col gap-5">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 self-start rounded-sm type-body-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Templates
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 type-body-sm text-ink-muted">
            {PROJECT_TYPE_LABELS[detail.projectType]}
            {published && <Badge>v{published.versionNumber} published</Badge>}
            {draft && <Badge variant="accent">Draft v{draft.versionNumber}</Badge>}
          </p>
          <h1 className="type-display-md text-balance text-ink md:type-display-lg">
            {detail.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body-sm text-ink-muted">
            {situation}
            {!readOnly && (
              <span
                aria-live="polite"
                className={
                  dirty ? 'inline-flex items-center gap-1.5 text-at-risk' : 'text-ink-faint'
                }
              >
                {dirty && <span aria-hidden className="size-1.5 rounded-full bg-at-risk-solid" />}
                {dirty ? 'Unsaved changes' : draft ? 'All changes saved' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="quiet"
            size="sm"
            leadingIcon={<History aria-hidden />}
            onClick={onHistory}
          >
            History
          </Button>
          {!readOnly && (
            <>
              <Button
                variant="quiet"
                size="sm"
                leadingIcon={<Archive aria-hidden />}
                onClick={onArchive}
              >
                Archive
              </Button>
              <Button
                size="sm"
                leadingIcon={<Save aria-hidden />}
                disabled={!dirty || stale}
                pending={saving}
                onClick={onSave}
              >
                Save draft
              </Button>
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<Send aria-hidden />}
                disabled={(!draft && !dirty) || stale}
                onClick={onPublish}
              >
                Publish
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
