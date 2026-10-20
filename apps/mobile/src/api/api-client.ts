import { apiContractOptions, apiRouterDefinition } from '@lintel/api-contracts';
import {
  type ApiFetcherArgs,
  type AppRoute,
  initClient,
  initContract,
  isZodType,
} from '@ts-rest/core';
import { API_BASE_URL } from './api-base-url';
import { apiErrorFrom, ContractMismatchError, NetworkError } from './api-error';
import { markApiReachable, markApiUnreachable } from './reachability';
import { reportSessionExpired, sessionToken } from './session-token';

/** The same router the API serves (see apps/api/src/contract.ts). */
export const apiContract = initContract().router(apiRouterDefinition, apiContractOptions);

const REQUEST_TIMEOUT_MS = 20_000;

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  return contentType.startsWith('text/') ? response.text() : undefined;
}

/** 2xx bodies are checked against the contract so screens can trust their types. */
function validatedBody(route: AppRoute, status: number, body: unknown): unknown {
  const schema: unknown = route.responses[status];
  if (!isZodType(schema)) return body;
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  if (__DEV__) {
    console.warn(
      `[api] ${route.method} ${route.path} answered with an unexpected shape`,
      parsed.error.issues,
    );
  }
  throw new ContractMismatchError(`${route.method} ${route.path}`);
}

function linkAbort(controller: AbortController, external: AbortSignal | null | undefined): void {
  if (!external) return;
  if (external.aborted) controller.abort();
  else external.addEventListener('abort', () => controller.abort(), { once: true });
}

/**
 * ts-rest fetcher: bearer auth, timeouts, reachability tracking, session
 * expiry on 401, and response validation.
 */
async function lintelFetcher(args: ApiFetcherArgs) {
  const token = sessionToken();
  const headers: Record<string, string> = { ...args.headers, accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (args.contentType === 'multipart/form-data') delete headers['content-type'];
  const controller = new AbortController();
  const callerSignal = args.signal ?? args.fetchOptions?.signal;
  linkAbort(controller, callerSignal);
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(args.path, {
      method: args.method,
      headers,
      body: args.body ?? null,
      signal: controller.signal,
    });
  } catch (error) {
    // A cancelled query is not an outage.
    if (callerSignal?.aborted) throw error;
    markApiUnreachable();
    throw new NetworkError();
  } finally {
    clearTimeout(timeout);
  }
  markApiReachable();
  const body = await readBody(response);
  if (response.status === 401 && token) reportSessionExpired();
  const checkedBody = response.ok ? validatedBody(args.route, response.status, body) : body;
  return { status: response.status, body: checkedBody, headers: response.headers };
}

export const api = initClient(apiContract, {
  baseUrl: API_BASE_URL,
  api: lintelFetcher,
  validateResponse: false,
  throwOnUnknownStatus: false,
});

type SuccessStatus = 200 | 201 | 204;
type SuccessResponse<T> = Extract<T, { status: SuccessStatus }>;

function isSuccess<T extends { status: number }>(response: T): response is SuccessResponse<T> {
  return response.status >= 200 && response.status < 300;
}

/** Resolves to the success body or throws an `ApiError` carrying the server's message. */
export async function unwrap<T extends { status: number; body: unknown }>(
  request: Promise<T>,
): Promise<SuccessResponse<T>['body']> {
  const response = await request;
  if (isSuccess(response)) return response.body;
  throw apiErrorFrom(response.status, response.body);
}
