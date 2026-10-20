import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { useSession } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { GUTTER, SPACE } from '@/theme/layout';

/** Shown when a saved session exists but the server could not be reached at launch. */
export default function ReconnectScreen() {
  const { retryRestore, signOut } = useSession();
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.body}>
        <Icon name="offline" size={36} color={colors.textSecondary} />
        <AppText variant="displayMd" align="center">
          Can’t reach Lintel
        </AppText>
        <AppText variant="body" tone="secondary" align="center" style={styles.message}>
          Lintel works online. Check your Wi-Fi or mobile data, then try again. You’re still signed
          in.
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button label="Try again" size="lg" icon="refresh" onPress={retryRestore} />
        <Button label="Sign out" variant="quiet" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: GUTTER },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  message: { maxWidth: 340 },
  actions: { gap: SPACE.sm, paddingBottom: SPACE.lg },
});
