import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { useToast } from '@/feedback/toast';
import {
  currentPushPermission,
  type PushPermission,
  registerPushDevice,
  requestPushPermission,
} from '@/push/push-device';
import { STORAGE_KEYS, writeSecure } from '@/session/secure-storage';

const SUBTITLE: Readonly<Record<PushPermission, string>> = {
  granted: 'On. Lintel tells you about assignments, reviews, blockers and leave.',
  denied: 'Off in your phone’s settings. Turn them on there to hear about changes.',
  undetermined: 'Off. Turn on to hear about assignments, reviews and blockers.',
};

/** Push permission state, with the one action that changes it from here. */
export function PushSettings() {
  const toast = useToast();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-read on focus and on return from the phone's Settings app.
  useFocusEffect(
    useCallback(() => {
      const read = () => {
        void currentPushPermission()
          .then(setPermission)
          .catch(() => setPermission(null));
      };
      read();
      const subscription = AppState.addEventListener('change', (status) => {
        if (status === 'active') read();
      });
      return () => subscription.remove();
    }, []),
  );

  const enable = async () => {
    setBusy(true);
    try {
      const next = await requestPushPermission();
      setPermission(next);
      await writeSecure(STORAGE_KEYS.pushPromptAnswered, next === 'granted' ? 'enabled' : 'later');
      if (next !== 'granted') return;
      const result = await registerPushDevice();
      toast.show(
        result.outcome === 'registered' ? 'Notifications are on.' : result.reason,
        result.outcome === 'registered' ? 'success' : 'info',
      );
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (permission === null) return null;
  return (
    <ListRow
      icon={permission === 'granted' ? 'notifications' : 'notificationsOff'}
      title="Push notifications"
      subtitle={SUBTITLE[permission]}
      trailing={
        permission === 'undetermined' ? (
          <Button label="Turn on" onPress={() => void enable()} loading={busy} />
        ) : permission === 'denied' ? (
          <Button
            label="Settings"
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        ) : null
      }
    />
  );
}
