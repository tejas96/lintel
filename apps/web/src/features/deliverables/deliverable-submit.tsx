'use client';

import type { DeliverableDetail } from '@lintel/api-contracts';
import { Button, Field, Input } from '@lintel/design-system/web';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatFileSize, useFileUpload } from '@/features/tasks/detail/use-file-upload';
import { useDeliverableMutations } from './use-deliverables';

/** Upload a file and send it for review as the next version. */
export function DeliverableSubmit({ deliverable }: { readonly deliverable: DeliverableDetail }) {
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const upload = useFileUpload(deliverable.project.id);
  const { submitVersion } = useDeliverableMutations(deliverable.project.id);
  const busy = upload.isPending || submitVersion.isPending;
  const nextVersion = deliverable.currentVersionNumber + 1;

  const submit = () => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (stored) =>
        submitVersion.mutate(
          {
            deliverableId: deliverable.id,
            fileId: stored.id,
            note: note.trim() || null,
            version: deliverable.version,
          },
          {
            onSuccess: () => {
              setFile(null);
              setNote('');
            },
          },
        ),
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-rule p-4">
      <p className="type-title-md text-ink">Submit version {nextVersion}</p>
      <input
        ref={picker}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Upload aria-hidden />}
          onClick={() => picker.current?.click()}
        >
          {file ? 'Choose a different file' : 'Choose a file'}
        </Button>
        {file && (
          <span className="type-body-sm text-ink-muted">
            {file.name} <span className="text-ink-faint">{formatFileSize(file.size)}</span>
          </span>
        )}
      </div>
      <Field label="Note for the reviewer" hint="Optional. What changed since the last version?">
        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
      </Field>
      <Button
        variant="primary"
        size="sm"
        className="self-start"
        disabled={!file}
        pending={busy}
        onClick={submit}
      >
        Send for review
      </Button>
    </div>
  );
}
