import { useSyncExternalStore } from 'react';

/**
 * Whether the last request reached the API. NetInfo knows about the device's
 * connection; this knows whether Lintel's server actually answered.
 */
let apiUnreachable = false;
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  if (apiUnreachable === next) return;
  apiUnreachable = next;
  for (const listener of listeners) listener();
}

export function markApiReachable(): void {
  publish(false);
}

export function markApiUnreachable(): void {
  publish(true);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useApiUnreachable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => apiUnreachable,
    () => false,
  );
}
