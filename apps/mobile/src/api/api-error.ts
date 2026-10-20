import { type ErrorResponse, errorResponseSchema } from '@lintel/api-contracts';
import type { ErrorCode } from '@lintel/shared';

const FALLBACK_MESSAGES: Readonly<Record<number, string>> = {
  401: 'Your session has ended. Please sign in again.',
  403: 'You don’t have access to this.',
  404: 'This item no longer exists or you don’t have access to it.',
  409: 'Someone else changed this a moment ago. Refresh and try again.',
  429: 'Too many attempts. Please wait a moment and try again.',
  503: 'Lintel is temporarily unavailable. Please try again shortly.',
};

/** A non-2xx answer from the API, carrying its stable error code and safe message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ErrorResponse['details'];
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, response: ErrorResponse | null) {
    super(
      response?.message ?? FALLBACK_MESSAGES[status] ?? 'Something went wrong. Please try again.',
    );
    this.name = 'ApiError';
    this.status = status;
    this.code = response?.code ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED');
    this.details = response?.details ?? [];
    this.requestId = response?.requestId ?? null;
    this.retryAfterSeconds = response?.retryAfterSeconds ?? null;
  }
}

/** The request never got an answer (offline, DNS, timeout, server down). */
export class NetworkError extends Error {
  constructor(message = 'Can’t reach Lintel. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** The API answered with a body that does not match the contract. */
export class ContractMismatchError extends Error {
  constructor(route: string) {
    super(
      'Lintel sent an answer this version of the app does not understand. Please update the app.',
    );
    this.name = 'ContractMismatchError';
    this.cause = route;
  }
}

export function apiErrorFrom(status: number, body: unknown): ApiError {
  const parsed = errorResponseSchema.safeParse(body);
  return new ApiError(status, parsed.success ? parsed.data : null);
}

/** A message that is always safe and useful to show a person. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  if (error instanceof ContractMismatchError) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Per-field messages from a VALIDATION_FAILED answer, keyed by field name. */
export function fieldErrors(error: unknown): Readonly<Record<string, string>> {
  if (!(error instanceof ApiError)) return {};
  const fields: Record<string, string> = {};
  for (const detail of error.details) {
    if (detail.field && !fields[detail.field]) fields[detail.field] = detail.message;
  }
  return fields;
}

/** True when the route is not implemented on this server yet (or the item is gone). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NOT_FOUND';
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && (error.status >= 500 || error.code === 'RATE_LIMITED');
}

/**
 * The message to toast after a refused submit, or null when every problem is
 * already shown beside a field on screen (`shownFields`).
 */
export function unshownErrorMessage(error: unknown, shownFields: readonly string[]): string | null {
  if (!(error instanceof ApiError) || error.details.length === 0) return errorMessage(error);
  const unshown = error.details.find(
    (detail) => !detail.field || !shownFields.includes(detail.field),
  );
  return unshown ? unshown.message : null;
}
