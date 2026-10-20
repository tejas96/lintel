import { errorResponseSchema } from '@lintel/api-contracts';
import type { ErrorCode } from '@lintel/shared';

export type ApiErrorCode = ErrorCode | 'NETWORK_UNREACHABLE' | 'UNEXPECTED_RESPONSE';

interface ApiErrorInit {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: readonly { readonly field?: string | undefined; readonly message: string }[];
  readonly requestId?: string | null;
  readonly retryAfterSeconds?: number | null;
}

/** Every failed API call becomes one of these, with a message that is safe to show. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: readonly { readonly field?: string | undefined; readonly message: string }[];
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isStaleVersion(): boolean {
    return this.code === 'STALE_VERSION';
  }

  /** Field-level messages keyed by field path ("nationalNumber", "query.search"). */
  fieldErrors(): Readonly<Record<string, string>> {
    const errors: Record<string, string> = {};
    for (const detail of this.details) {
      if (detail.field && !errors[detail.field]) errors[detail.field] = detail.message;
    }
    return errors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function retryAfterFrom(headers: Headers | undefined): number | null {
  const value = headers?.get('retry-after');
  const seconds = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(seconds) ? seconds : null;
}

/** Builds an ApiError from any non-success response, validating the shared error shape. */
export function toApiError(status: number, body: unknown, headers?: Headers): ApiError {
  const parsed = errorResponseSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError({
      status,
      code: parsed.data.code,
      message: parsed.data.message,
      details: parsed.data.details,
      requestId: parsed.data.requestId,
      retryAfterSeconds: parsed.data.retryAfterSeconds ?? retryAfterFrom(headers),
    });
  }
  return new ApiError({
    status,
    code: status >= 500 ? 'INTERNAL' : 'UNEXPECTED_RESPONSE',
    message:
      status >= 500
        ? 'Lintel’s server could not finish that. Please try again in a moment.'
        : 'The server sent an answer Lintel did not expect. Refresh the page and try again.',
    requestId: headers?.get('x-request-id') ?? null,
    retryAfterSeconds: retryAfterFrom(headers),
  });
}

export const networkError = (): ApiError =>
  new ApiError({
    status: 0,
    code: 'NETWORK_UNREACHABLE',
    message: 'Lintel can’t reach the server. Check your connection, then try again.',
  });
