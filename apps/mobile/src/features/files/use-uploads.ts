import type { FileSummary } from '@lintel/api-contracts';
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '@/api/api-error';
import { type LocalFile, uploadFile } from '@/api/file-transfer';
import { newIdempotencyKey } from '@/api/idempotency-key';

export interface UploadItem {
  readonly key: string;
  /** Sent as Idempotency-Key; reused by Retry so a lost answer is replayed, not re-uploaded. */
  readonly idempotencyKey: string;
  readonly file: LocalFile;
  readonly progress: number;
  readonly status: 'uploading' | 'done' | 'failed';
  readonly result: FileSummary | null;
  readonly error: string | null;
}

/**
 * Uploads files one by one with live progress. Each finished upload is passed
 * to `onUploaded` (e.g. to attach it to a task).
 */
export function useUploads(onUploaded?: (file: FileSummary) => Promise<unknown> | undefined) {
  const [items, setItems] = useState<readonly UploadItem[]>([]);
  const counter = useRef(0);

  const update = useCallback((key: string, change: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }, []);

  const uploadOne = useCallback(
    async (key: string, file: LocalFile, idempotencyKey: string) => {
      update(key, { status: 'uploading', progress: 0, error: null });
      try {
        const result = await uploadFile(file, {
          idempotencyKey,
          onProgress: (progress) => update(key, { progress }),
        });
        await onUploaded?.(result);
        update(key, { status: 'done', progress: 1, result });
      } catch (error) {
        update(key, { status: 'failed', error: errorMessage(error) });
      }
    },
    [onUploaded, update],
  );

  const start = useCallback(
    async (files: readonly LocalFile[]) => {
      const added = files.map((file) => {
        counter.current += 1;
        return {
          key: `upload-${counter.current}`,
          idempotencyKey: newIdempotencyKey(),
          file,
          progress: 0,
          status: 'uploading' as const,
          result: null,
          error: null,
        };
      });
      setItems((current) => [...current, ...added]);
      for (const item of added) await uploadOne(item.key, item.file, item.idempotencyKey);
    },
    [uploadOne],
  );

  const retry = useCallback(
    (key: string) => {
      const item = items.find((candidate) => candidate.key === key);
      if (item) void uploadOne(key, item.file, item.idempotencyKey);
    },
    [items, uploadOne],
  );

  const remove = useCallback((key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return {
    items,
    start,
    retry,
    remove,
    clear,
    busy: items.some((item) => item.status === 'uploading'),
    uploaded: items.flatMap((item) => (item.result ? [item.result] : [])),
  };
}
