import { useNetInfo } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, ReduceMotion, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApiUnreachable } from '@/api/reachability';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';

/**
 * Lintel is online-first. When the phone is offline or the server can't be
 * reached, say so plainly instead of pretending changes were saved.
 */
export function NetworkBanner() {
  const netInfo = useNetInfo();
  const apiUnreachable = useApiUnreachable();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { status } = useAppTheme();
  const offline = netInfo.isConnected === false;
  if (!offline && !apiUnreachable) return null;
  const message = offline
    ? 'You’re offline. Lintel needs a connection — changes can’t be saved until you’re back.'
    : 'Can’t reach Lintel’s server right now.';
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + SPACE.xs }]}>
      <Animated.View
        entering={SlideInUp.springify().damping(24).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          { backgroundColor: status.atRisk.tint, borderColor: status.atRisk.solid },
        ]}
      >
        <Icon name={offline ? 'offline' : 'error'} size={18} color={status.atRisk.fg} />
        <AppText variant="bodySm" color={status.atRisk.fg} style={styles.text}>
          {message}
        </AppText>
        {offline ? null : (
          <Button
            label="Retry"
            variant="quiet"
            onPress={() => void queryClient.refetchQueries({ type: 'active' })}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: SPACE.md, right: SPACE.md, alignItems: 'center', zIndex: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    maxWidth: 560,
    width: '100%',
  },
  text: { flex: 1, paddingVertical: SPACE.sm },
});
