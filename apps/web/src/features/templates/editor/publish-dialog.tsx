'use client';

import type { TemplateDetail } from '@lintel/api-contracts';
import { Button, Dialog, Field, Textarea } from '@lintel/design-system/web';
import { useState } from 'react';
import { draftOf } from '../template-types';

interface PublishDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly detail: TemplateDetail;
  readonly pending: boolean;
  readonly onPublish: (changeNotes: string | null) => void;
}

/** Publishing makes the draft what new projects start from; running projects are untouched. */
export function PublishDialog({
  open,
  onOpenChange,
  detail,
  pending,
  onPublish,
}: PublishDialogProps) {
  const draft = draftOf(detail);
  const [notes, setNotes] = useState(draft?.changeNotes ?? '');
  const published = detail.publishedVersion;
  const running =
    detail.versions.find((version) => version.status === 'published')?.projectCount ?? 0;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Publish version ${draft?.versionNumber ?? (published ? published.versionNumber + 1 : 1)}`}
      description={
        !published
          ? 'New projects of this kind will be able to start from it.'
          : running === 0
            ? `New projects will start from this version. No project uses version ${published.versionNumber} yet.`
            : `New projects will start from this version. ${running === 1 ? 'The one project' : `The ${running} projects`} on version ${published.versionNumber} ${running === 1 ? 'keeps the workflow it' : 'keep the workflow they'} started with.`
      }
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Not yet
          </Button>
          <Button
            variant="primary"
            pending={pending}
            onClick={() => onPublish(notes.trim() || null)}
          >
            Publish
          </Button>
        </>
      }
    >
      <Field label="What changed" hint="Optional. Shown in the version history so others know why.">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={1000}
        />
      </Field>
    </Dialog>
  );
}
