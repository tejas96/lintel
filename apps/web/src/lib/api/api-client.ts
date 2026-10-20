'use client';

import { type ApiFetcher, initClient, tsRestFetchApi } from '@ts-rest/core';
import { networkError, toApiError } from './api-error';
import { apiContract, CSRF_COOKIE, CSRF_HEADER } from './contract';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Adds the double-submit CSRF header to unsafe requests and turns network
 * failures into a readable ApiError. Cookies travel automatically (same origin).
 */
const lintelFetcher: ApiFetcher = async (args) => {
  const headers: Record<string, string> = { ...args.headers };
  if (UNSAFE_METHODS.has(args.method.toUpperCase())) {
    const token = readCookie(CSRF_COOKIE);
    if (token) headers[CSRF_HEADER] = token;
  }
  try {
    return await tsRestFetchApi({
      ...args,
      headers,
      fetchOptions: { ...args.fetchOptions, credentials: 'same-origin', cache: 'no-store' },
    });
  } catch {
    throw networkError();
  }
};

/** Typed client for every route in the contract. Use with `expectStatus`. */
export const api = initClient(apiContract, {
  baseUrl: '/api',
  baseHeaders: {},
  api: lintelFetcher,
  throwOnUnknownStatus: false,
  validateResponse: false,
});

interface AnyResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Headers;
}

function hasStatus<TResponse extends AnyResponse, TStatus extends number>(
  response: TResponse,
  status: TStatus,
): response is Extract<TResponse, { status: TStatus }> {
  return response.status === status;
}

/**
 * Resolves to the body of the expected success status; any other status
 * throws an ApiError carrying the server's safe message and request id.
 */
export async function expectStatus<
  TResponse extends AnyResponse,
  TStatus extends TResponse['status'],
>(
  request: Promise<TResponse>,
  status: TStatus,
): Promise<Extract<TResponse, { status: TStatus }>['body']> {
  const response = await request;
  if (hasStatus(response, status)) return response.body;
  throw toApiError(response.status, response.body, response.headers);
}
