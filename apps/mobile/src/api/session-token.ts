/**
 * The in-memory copy of the bearer token used by every request. The durable
 * copy lives only in the secure store (see session/session-storage.ts).
 */
let currentToken: string | null = null;
const expiryListeners = new Set<() => void>();

export function setSessionToken(token: string | null): void {
  currentToken = token;
}

export function sessionToken(): string | null {
  return currentToken;
}

/** Called by the fetcher when a request that carried a token is answered 401. */
export function reportSessionExpired(): void {
  if (!currentToken) return;
  currentToken = null;
  for (const listener of expiryListeners) listener();
}

export function onSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}
