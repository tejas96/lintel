import { type FileSummary, fileSummarySchema } from '@lintel/api-contracts';
import { API_BASE_URL } from './api-base-url';
import { apiErrorFrom, ContractMismatchError, NetworkError } from './api-error';
import { markApiReachable, markApiUnreachable } from './reachability';
import { reportSessionExpired, sessionToken } from './session-token';

export interface LocalFile {
  readonly uri: string;
  readonly name: string;
  readonly mimeType: string;
}

export interface UploadOptions {
  /** Reuse the same key when retrying the same file, so a lost answer is replayed. */
  readonly idempotencyKey?: string;
  readonly onProgress?: (fraction: number) => void;
  readonly signal?: AbortSignal;
}

/** React Native's FormData accepts a file reference by URI instead of a Blob. */
interface NativeFormDataFile {
  readonly uri: string;
  readonly name: string;
  readonly type: string;
}

function appendNativeFile(form: FormData, field: string, file: NativeFormDataFile): void {
  (form as unknown as { append(name: string, value: NativeFormDataFile): void }).append(
    field,
    file,
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * POST /v1/files (multipart field "file"). Uses XMLHttpRequest because fetch
 * cannot report upload progress.
 */
export function uploadFile(file: LocalFile, options: UploadOptions = {}): Promise<FileSummary> {
  return new Promise((resolve, reject) => {
    const token = sessionToken();
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE_URL}/v1/files`);
    request.setRequestHeader('accept', 'application/json');
    if (token) request.setRequestHeader('authorization', `Bearer ${token}`);
    if (token && options.idempotencyKey) {
      request.setRequestHeader('idempotency-key', options.idempotencyKey);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        options.onProgress?.(event.loaded / event.total);
    };
    request.onerror = () => {
      markApiUnreachable();
      reject(
        new NetworkError('The upload didn’t reach Lintel. Check your connection and try again.'),
      );
    };
    request.onabort = () => reject(new NetworkError('Upload cancelled.'));
    request.onload = () => {
      markApiReachable();
      const body = parseJson(request.responseText);
      if (request.status === 401 && token) reportSessionExpired();
      if (request.status < 200 || request.status >= 300) {
        reject(apiErrorFrom(request.status, body));
        return;
      }
      const parsed = fileSummarySchema.safeParse(body);
      if (parsed.success) resolve(parsed.data);
      else reject(new ContractMismatchError('POST /v1/files'));
    };
    options.signal?.addEventListener('abort', () => request.abort(), { once: true });
    const form = new FormData();
    appendNativeFile(form, 'file', { uri: file.uri, name: file.name, type: file.mimeType });
    request.send(form);
  });
}

/** An expo-image source for GET /v1/files/:id/content with the bearer header. */
export function fileContentSource(fileId: string) {
  const token = sessionToken();
  return {
    uri: `${API_BASE_URL}/v1/files/${fileId}/content`,
    cacheKey: `lintel-file-${fileId}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}
