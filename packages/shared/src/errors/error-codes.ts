/**
 * Stable, machine-readable error codes. Clients branch on these codes,
 * so existing values must never be renamed.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'INVALID_TRANSITION',
  'PRECONDITION_FAILED',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'FEATURE_DISABLED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS_BY_ERROR_CODE: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  STALE_VERSION: 409,
  INVALID_TRANSITION: 422,
  PRECONDITION_FAILED: 422,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 503,
  FEATURE_DISABLED: 503,
  INTERNAL: 500,
};
