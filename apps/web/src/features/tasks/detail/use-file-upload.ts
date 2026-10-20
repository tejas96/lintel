'use client';

import { useMutation } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { useFailureToast } from '@/lib/query/use-failure-toast';

/** Uploads one file (multipart field "file"); the server detects its type and checks its size. */
export function useFileUpload(projectId: string) {
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (file: File) =>
      expectStatus(
        api.deliverables.uploadFile({ body: { file, projectId, visibility: 'project' } }),
        201,
      ),
    onError: (error) => fail(error, 'upload the file'),
  });
}

/** Content URL for a stored file, served through the same-origin API proxy. */
export function fileContentUrl(fileId: string): string {
  return `/api/v1/files/${fileId}/content`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
