'use client';

import type { ProjectDocument } from '@lintel/api-contracts';
import { Avatar, Badge, Button, Field, Sheet, Textarea } from '@lintel/design-system/web';
import { Archive, Download, ExternalLink, LockKeyhole } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { fileContentUrl, formatFileSize } from '@/features/tasks/detail/use-file-upload';
import { formatRelativeInstant } from '@/lib/format/dates';
import {
  canPreviewInline,
  DocumentThumbnail,
  folderLabel,
  KIND_LABELS,
} from './document-presentation';
import { useDocumentMutations } from './use-documents';

function Detail({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="type-body-sm text-ink-faint">{label}</dt>
      <dd className="flex min-h-6 min-w-0 items-center gap-2 type-body-sm text-ink">{children}</dd>
    </div>
  );
}

function DocumentDetails({ document }: { readonly document: ProjectDocument }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      <Detail label="Added by">
        <Avatar
          name={document.addedBy.fullName}
          hue={document.addedBy.avatarHue}
          size="xs"
          decorative
        />
        <span className="truncate">{document.addedBy.fullName}</span>
      </Detail>
      <Detail label="Added">{formatRelativeInstant(document.createdAt)}</Detail>
      <Detail label="File">
        <span className="truncate font-mono text-[0.8125rem]">{document.file.originalName}</span>
      </Detail>
      <Detail label="Who can see it">
        {document.visibility === 'confidential'
          ? 'Project managers, the owner and administrators'
          : 'Everyone on the project'}
      </Detail>
    </dl>
  );
}

/** Open (photos, in a new tab) or download (everything else) through the access-checked route. */
function OpenLink({ document }: { readonly document: ProjectDocument }) {
  const inline = canPreviewInline(document);
  const Icon = inline ? ExternalLink : Download;
  return (
    <Button asChild variant="primary">
      <a
        href={fileContentUrl(document.file.id)}
        {...(inline
          ? { target: '_blank', rel: 'noreferrer' }
          : { download: document.file.originalName })}
      >
        <Icon aria-hidden className="size-4" />
        {inline ? 'Open full size' : 'Download'}
      </a>
    </Button>
  );
}

function Preview({ document }: { readonly document: ProjectDocument }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      {canPreviewInline(document) ? (
        // biome-ignore lint/performance/noImgElement: private files come through the API proxy, not next/image
        <img
          src={fileContentUrl(document.file.id)}
          alt={document.title}
          className="max-h-[55dvh] w-full bg-sunken object-contain"
        />
      ) : (
        <div className="aspect-[16/9]">
          <DocumentThumbnail document={document} />
        </div>
      )}
    </div>
  );
}

/**
 * A document opened from the library: a large preview for photos, the file
 * details, a way to open or download it, and (for the person who added it or
 * the manager) archiving with an optional reason.
 */
export function DocumentPreviewSheet({
  projectId,
  document,
  onClose,
}: {
  readonly projectId: string;
  readonly document: ProjectDocument | null;
  readonly onClose: () => void;
}) {
  const { archive } = useDocumentMutations(projectId);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const close = () => {
    setConfirming(false);
    setReason('');
    onClose();
  };
  const archiveNow = (target: ProjectDocument) =>
    archive.mutate({ document: target, reason: reason.trim() || null }, { onSuccess: close });
  const confirmFooter = document && (
    <>
      <Button variant="quiet" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
      <Button variant="danger" pending={archive.isPending} onClick={() => archiveNow(document)}>
        Archive document
      </Button>
    </>
  );
  const footer = document && (
    <>
      {document.viewerCanArchive && (
        <Button
          variant="quiet"
          leadingIcon={<Archive aria-hidden />}
          onClick={() => setConfirming(true)}
          className="mr-auto"
        >
          Archive
        </Button>
      )}
      <OpenLink document={document} />
    </>
  );
  return (
    <Sheet
      open={document !== null}
      onOpenChange={(open) => !open && close()}
      width="lg"
      title={document?.title ?? ''}
      description={
        document
          ? `${folderLabel(document.folder)} · ${KIND_LABELS[document.kind]} · ${formatFileSize(document.file.sizeBytes)}`
          : undefined
      }
      header={
        document?.visibility === 'confidential' ? (
          <Badge variant="soft" className="self-start">
            <LockKeyhole aria-hidden className="size-3" />
            Confidential: project managers only
          </Badge>
        ) : null
      }
      footer={confirming ? confirmFooter : footer}
    >
      {document && (
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <Preview document={document} />
          {confirming ? (
            <div className="flex flex-col gap-3 rounded-lg border border-overdue-solid/30 bg-overdue-tint/40 p-4">
              <p className="type-body-sm text-ink">
                Archiving takes the document out of the library and its file can no longer be
                opened. The record of who added and archived it stays in the audit log.
              </p>
              <Field label="Why is it being archived?" hint="Optional. Kept with the audit record.">
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="For example: replaced by revision C"
                />
              </Field>
            </div>
          ) : (
            <DocumentDetails document={document} />
          )}
        </div>
      )}
    </Sheet>
  );
}
