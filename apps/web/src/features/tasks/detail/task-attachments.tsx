'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Button, listItemEnter } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Paperclip } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { formatRelativeInstant } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { DetailSection } from './detail-section';
import { fileContentUrl, formatFileSize, useFileUpload } from './use-file-upload';

/** Reference files and site photos. Images show inline; other files download. */
export function TaskAttachments({ task }: { readonly task: TaskDetail }) {
  const picker = useRef<HTMLInputElement>(null);
  const upload = useFileUpload(task.project.id);
  const queryClient = useQueryClient();
  const fail = useFailureToast();
  const attach = useMutation({
    mutationFn: (fileId: string) =>
      expectStatus(
        api.deliverables.attachFileToTask({ params: { id: task.id }, body: { fileId } }),
        200,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) }),
    onError: (error) => fail(error, 'attach the file', [queryKeys.task(task.id)]),
  });
  const images = task.attachments.filter((file) => file.isImage);
  const documents = task.attachments.filter((file) => !file.isImage);
  const busy = upload.isPending || attach.isPending;

  return (
    <DetailSection
      title="Attachments"
      meta={task.attachments.length > 0 ? String(task.attachments.length) : undefined}
      action={
        <>
          <input
            ref={picker}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) upload.mutate(file, { onSuccess: (stored) => attach.mutate(stored.id) });
            }}
          />
          <Button
            size="sm"
            variant="quiet"
            pending={busy}
            leadingIcon={<Paperclip aria-hidden />}
            onClick={() => picker.current?.click()}
          >
            Attach a file
          </Button>
        </>
      }
    >
      {task.attachments.length === 0 && (
        <p className="type-body-sm text-ink-faint">
          Nothing attached. Add drawings, references or site photos.
        </p>
      )}
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((file, index) => (
            <motion.li key={file.id} {...listItemEnter(index)}>
              <a
                href={fileContentUrl(file.id)}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-md border border-hairline bg-sunken"
              >
                {/* biome-ignore lint/performance/noImgElement: private files come through the API proxy, not next/image */}
                <img
                  src={fileContentUrl(file.id)}
                  alt={file.originalName}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.03]"
                />
              </a>
            </motion.li>
          ))}
        </ul>
      )}
      {documents.length > 0 && (
        <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-raised">
          {documents.map((file) => (
            <li key={file.id} className="relative flex items-center gap-3 px-3 py-2.5">
              <FileText aria-hidden className="size-4 shrink-0 text-ink-faint" />
              <a
                href={fileContentUrl(file.id)}
                className="lt-stretched-link min-w-0 flex-1 truncate rounded-sm type-body-sm text-ink hover:underline"
              >
                {file.originalName}
              </a>
              <span className="shrink-0 type-body-sm text-ink-faint">
                {formatFileSize(file.sizeBytes)}, {formatRelativeInstant(file.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
