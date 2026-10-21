'use client';

import { useToast } from '@lintel/design-system/web';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { notificationsQueryKey } from '@/shell/use-notifications';
import {
  disableWebPush,
  enableWebPush,
  isWebPushSupported,
  onForegroundPush,
  type RemoveDevice,
  refreshWebPush,
  type SaveDevice,
  storedDeviceId,
  WebPushPermissionError,
} from './web-push-client';
import { WEB_PUSH_CONFIG } from './web-push-config';

/** `hidden`: the studio has no Firebase web config, so the feature is not offered at all. */
export type WebPushState = 'checking' | 'hidden' | 'unsupported' | 'blocked' | 'off' | 'on';

export const saveWebDevice: SaveDevice = (installationId) =>
  expectStatus(
    api.operations.registerDevice({
      body: { platform: 'web', tokenType: 'fcm_fid', token: installationId, appVersion: null },
    }),
    200,
  );

export const removeWebDevice: RemoveDevice = async (deviceId) => {
  await expectStatus(api.operations.unregisterDevice({ params: { id: deviceId } }), 204);
};

async function currentState(): Promise<WebPushState> {
  if (!WEB_PUSH_CONFIG) return 'hidden';
  if (!(await isWebPushSupported())) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && storedDeviceId() ? 'on' : 'off';
}

/** `declined`: the browser's permission was not granted; `failed`: an error toast was shown. */
export type WebPushEnableOutcome = 'on' | 'declined' | 'failed';

/** State and actions for "push to this browser" (Account page and the Today prompt). */
export function useWebPush() {
  const toast = useToast();
  const [state, setState] = useState<WebPushState>('checking');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let alive = true;
    void currentState().then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const enable = useCallback(async (): Promise<WebPushEnableOutcome> => {
    setWorking(true);
    try {
      await enableWebPush(saveWebDevice);
      setState('on');
      toast({ tone: 'success', title: 'Notifications are on for this browser' });
      return 'on';
    } catch (error) {
      if (error instanceof WebPushPermissionError) {
        setState(error.permission === 'denied' ? 'blocked' : 'off');
        return 'declined';
      }
      toast({
        tone: 'error',
        title: 'Could not turn on notifications',
        description: isApiError(error) ? error.message : 'Please try again in a moment.',
      });
      return 'failed';
    } finally {
      setWorking(false);
    }
  }, [toast]);

  const disable = useCallback(async () => {
    setWorking(true);
    try {
      await disableWebPush(removeWebDevice);
      setState('off');
      toast({ tone: 'success', title: 'Notifications are off for this browser' });
    } finally {
      setWorking(false);
    }
  }, [toast]);

  return { state, working, enable, disable };
}

const REFRESHED_KEY = 'lintel.web-push-refreshed';

/**
 * Mounted once in the app shell: re-registers this browser once per visit
 * (installation IDs can change) and refreshes the inbox when a push arrives
 * while Lintel is open. Does nothing unless web push was turned on here.
 */
export function useWebPushLifecycle(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!WEB_PUSH_CONFIG || !storedDeviceId()) return;
    let stop: (() => void) | null = null;
    let alive = true;
    try {
      if (!window.sessionStorage.getItem(REFRESHED_KEY)) {
        window.sessionStorage.setItem(REFRESHED_KEY, '1');
        void refreshWebPush(saveWebDevice).catch(() => undefined);
      }
    } catch {
      // Storage unavailable: skip the refresh, pushes keep working with the known ID.
    }
    void onForegroundPush(() => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    }).then((unsubscribe) => {
      if (alive) stop = unsubscribe;
      else unsubscribe();
    });
    return () => {
      alive = false;
      stop?.();
    };
  }, [queryClient]);
}
