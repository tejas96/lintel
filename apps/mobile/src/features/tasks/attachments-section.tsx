import type { TaskDetail } from '@lintel/api-contracts';
import { useCallback } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Section } from '@/components/section';
import { FileTile, UploadList } from '@/features/files/file-views';
import { SourceButtons } from '@/features/files/source-buttons';
import { useUploads } from '@/features/files/use-uploads';
import { useAttachFileToTask } from '@/queries/task-queries';
import { SPACE } from '@/theme/layout';

/** Drawings, photos and documents on the task; add from the camera, photos or Files. */
export function AttachmentsSection({ task }: { readonly task: TaskDetail }) {
  const attach = useAttachFileToTask(task.id);
  const attachUploaded = useCallback(
    (file: { readonly id: string }) => attach.mutateAsync(file.id),
    [attach.mutateAsync],
  );
  const uploads = useUploads(attachUploaded);
  const pending = uploads.items.filter((item) => item.status !== 'done');
  return (
    <Section
      title="Files"
      meta={task.attachments.length > 0 ? String(task.attachments.length) : undefined}
    >
      {task.attachments.length === 0 && pending.length === 0 ? (
        <AppText variant="bodySm" tone="secondary">
          {task.viewerCanEdit
            ? 'No files yet. Add a photo of the site, a drawing or a document.'
            : 'No files yet.'}
        </AppText>
      ) : null}
      <View style={{ gap: SPACE.md }}>
        {task.attachments.map((file) => (
          <FileTile key={file.id} file={file} />
        ))}
      </View>
      <UploadList items={pending} onRetry={uploads.retry} onRemove={uploads.remove} />
      {task.viewerCanEdit ? (
        <SourceButtons onPicked={(files) => void uploads.start(files)} disabled={uploads.busy} />
      ) : null}
    </Section>
  );
}
