import type { ErrorCode } from './error-codes';

/** A single human-readable problem, optionally tied to an input field. */
export interface ErrorDetail {
  readonly field?: string;
  readonly message: string;
}

/**
 * Base error for expected business failures. The message is safe to show to
 * users; never put secrets, tokens or personal data in it.
 */
export class ApplicationError extends Error {
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[];

  constructor(code: ErrorCode, message: string, details: readonly ErrorDetail[] = []) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationFailedError extends ApplicationError {
  constructor(message: string, details: readonly ErrorDetail[] = []) {
    super('VALIDATION_FAILED', message, details);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(entity: string) {
    super('NOT_FOUND', `${entity} was not found.`);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'You do not have permission to do this.') {
    super('FORBIDDEN', message);
  }
}

export class UnauthenticatedError extends ApplicationError {
  constructor(message = 'Please sign in to continue.') {
    super('UNAUTHENTICATED', message);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, details: readonly ErrorDetail[] = []) {
    super('CONFLICT', message, details);
  }
}

export class StaleVersionError extends ApplicationError {
  constructor(entity: string) {
    super('STALE_VERSION', `${entity} was changed by someone else. Refresh and try again.`);
  }
}

export class InvalidTransitionError extends ApplicationError {
  constructor(message: string, details: readonly ErrorDetail[] = []) {
    super('INVALID_TRANSITION', message, details);
  }
}

export class PreconditionFailedError extends ApplicationError {
  constructor(message: string, details: readonly ErrorDetail[] = []) {
    super('PRECONDITION_FAILED', message, details);
  }
}

export class RateLimitedError extends ApplicationError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super('RATE_LIMITED', message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DependencyUnavailableError extends ApplicationError {
  constructor(message: string) {
    super('DEPENDENCY_UNAVAILABLE', message);
  }
}

export class FeatureDisabledError extends ApplicationError {
  constructor(message: string) {
    super('FEATURE_DISABLED', message);
  }
}

export function isApplicationError(value: unknown): value is ApplicationError {
  return value instanceof ApplicationError;
}
