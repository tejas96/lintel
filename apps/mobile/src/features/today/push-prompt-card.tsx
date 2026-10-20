import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { useToast } from '@/feedback/toast';
import {
  currentPushPermission,
  registerPushDevice,
  requestPushPermission,
} from '@/push/push-device';
import { readSecure, STORAGE_KEYS, writeSecure } from '@/session/secure-storage';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { fadeIn, fadeOut } from '@/theme/motion';

/**
 * Asks for notification permission in context — on Today, once, after the
 * person has seen what Lintel would notify them about — never at launch.
 */
export function PushPromptCard() {
  const toast = useToast();
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([currentPushPermission(), readSecure(STORAGE_KEYS.pushPromptAnswered)])
      .then(([permission, answered]) => {
        if (mounted) setVisible(permission === 'undetermined' && answered === null);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const answer = (value: 'enabled' | 'later') => {
    setVisible(false);
    void writeSecure(STORAGE_KEYS.pushPromptAnswered, value);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await requestPushPermission();
      if (permission !== 'granted') {
        toast.show('Notifications are off. You can turn them on in Account at any time.', 'info');
        answer('later');
        return;
      }
      const result = await registerPushDevice();
      toast.show(
        result.outcome === 'registered' ? 'Notifications are on.' : result.reason,
        result.outcome === 'registered' ? 'success' : 'info',
      );
      answer('enabled');
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;
  return (
    <Animated.View entering={fadeIn} exiting={fadeOut}>
      <Card tone="accentSoft" style={styles.card}>
        <View style={styles.title}>
          <Icon name="notifications" size={20} color={colors.onAccentSoft} />
          <AppText variant="titleMd" color={colors.onAccentSoft}>
            Hear about changes as they happen
          </AppText>
        </View>
        <AppText variant="bodySm" color={colors.onAccentSoft}>
          Lintel can tell you when work is assigned to you, a review comes back, something you’re
          waiting on is unblocked, or leave is decided. Your quiet hours are respected.
        </AppText>
        <View style={styles.actions}>
          <Button label="Turn on" onPress={() => void enable()} loading={busy} fill />
          <Button label="Not now" variant="secondary" onPress={() => answer('later')} fill />
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md },
  title: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  actions: { flexDirection: 'row', gap: SPACE.sm },
});
