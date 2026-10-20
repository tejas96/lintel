import type { ErrorKind } from '@lintel/design-system/web';
import { isApiError } from './api-error';

export interface ErrorDescription {
  readonly kind: ErrorKind;
  readonly title: string;
  readonly message: string;
  readonly requestId: string | null;
}

interface DescribeOptions {
  /**
   * What was being loaded. A 404 on a collection means that part of the API
   * is not switched on yet; on an item it means missing or not shared.
   */
  readonly resource?: 'collection' | 'item';
  /** Plain name of the thing, e.g. "task" or "project". */
  readonly noun?: string;
}

/** Turns any thrown value into words for an ErrorState. */
export function describeError(error: unknown, options: DescribeOptions = {}): ErrorDescription {
  const noun = options.noun ?? 'page';
  if (!isApiError(error)) {
    return {
      kind: 'error',
      title: 'Something went wrong',
      message: 'This part of the page stopped working. Reload to try again.',
      requestId: null,
    };
  }
  const requestId = error.requestId;
  if (error.code === 'NETWORK_UNREACHABLE') {
    return { kind: 'offline', title: 'You seem to be offline', message: error.message, requestId };
  }
  if (error.status === 403) {
    return {
      kind: 'forbidden',
      title: 'You don’t have access to this',
      message: `${error.message} Ask a studio administrator if you need it.`,
      requestId,
    };
  }
  if (error.status === 404 && options.resource === 'collection') {
    return {
      kind: 'unavailable',
      title: 'Not switched on yet',
      message: `This part of Lintel is not available on your studio’s server yet. Nothing is lost; it will appear here once it is turned on.`,
      requestId: null,
    };
  }
  if (error.status === 404) {
    return {
      kind: 'notFound',
      title: `This ${noun} isn’t available`,
      message: `It may have been removed, or it hasn’t been shared with you.`,
      requestId,
    };
  }
  if (error.isStaleVersion) {
    return {
      kind: 'stale',
      title: 'Someone else just changed this',
      message: 'Refresh to see the latest version before making your change.',
      requestId,
    };
  }
  if (error.status === 429) {
    const wait = error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} seconds.` : '';
    return {
      kind: 'error',
      title: 'Too many requests',
      message: `${error.message}${wait}`,
      requestId,
    };
  }
  return {
    kind: 'error',
    title: error.status >= 500 ? 'The server had a problem' : 'That didn’t work',
    message: error.message,
    requestId,
  };
}
