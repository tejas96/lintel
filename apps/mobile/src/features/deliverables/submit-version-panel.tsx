import type { DeliverableDetail } from '@lintel/api-contracts';
import { useState } from 'react';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { FileTile, UploadList } from '@/features/files/file-views';
import { SourceButtons } from '@/features/files/source-buttons';
import { useUploads } from '@/features/files/use-uploads';
import { useToast } from '@/feedback/toast';
import { useSubmitDeliverableVersion } from '@/queries/deliverable-queries';
import { SPACE } from '@/theme/layout';

/** Upload a drawing or photo (with progress), add a note and submit it for review. */
export function SubmitVersionPanel({ deliverable }: { readonly deliverable: DeliverableDetail }) {
  const toast = useToast();
  const submit = useSubmitDeliverableVersion(deliverable.id);
  const uploads = useUploads();
  const [note, setNote] = useState('');
  const file = uploads.uploaded[uploads.uploaded.length - 1] ?? null;
  const inFlight = uploads.items.filter((item) => item.status !== 'done');
  const next = deliverable.currentVersionNumber + 1;

  const send = () => {
    if (!file) return;
    submit.mutate(
      { fileId: file.id, note: note.trim() || null, version: deliverable.version },
      {
        onSuccess: () => {
          uploads.clear();
          setNote('');
          toast.show(`Version ${next} submitted for review.`, 'success');
        },
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  };

  return (
    <Card tone="raised" style={{ gap: SPACE.md }}>
      <AppText variant="titleMd">Submit version {next}</AppText>
      {file ? <FileTile file={file} /> : null}
      <UploadList items={inFlight} onRetry={uploads.retry} onRemove={uploads.remove} />
      <SourceButtons
        onPicked={(files) => {
          uploads.clear();
          void uploads.start(files.slice(0, 1));
        }}
        disabled={uploads.busy || submit.isPending}
      />
      <TextField
        label="Note for the reviewer (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={2000}
      />
      <Button
        label={uploads.busy ? 'Uploading…' : 'Submit for review'}
        size="lg"
        onPress={send}
        loading={submit.isPending}
        disabled={!file || uploads.busy}
      />
    </Card>
  );
}
