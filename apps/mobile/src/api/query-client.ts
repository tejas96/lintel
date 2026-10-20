import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { ApiError } from './api-error';

const MAX_RETRIES = 2;

/**
 * Online-first: data is cached for the session so screens open instantly, but
 * every change goes to the server immediately and fails visibly when offline.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      networkMode: 'online',
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500 && error.code !== 'RATE_LIMITED') {
          return false;
        }
        return failureCount < MAX_RETRIES;
      },
    },
    mutations: { networkMode: 'always', retry: false },
  },
});

/** Refetch stale data when the app comes back to the foreground. */
export function connectFocusManager(): () => void {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  });
  return () => subscription.remove();
}

/** Pause queries while the device has no connection; resume when it returns. */
export function connectOnlineManager(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    }),
  );
}
