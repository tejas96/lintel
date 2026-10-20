import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { connectFocusManager, connectOnlineManager, queryClient } from '@/api/query-client';
import { NetworkBanner } from '@/feedback/network-banner';
import { ToastProvider } from '@/feedback/toast';
import { configureForegroundNotifications } from '@/push/foreground-notifications';
import { SessionProvider, useSession } from '@/session/session-provider';
import { AppThemeProvider, useAppTheme } from '@/theme/app-theme';
import { FONT_ASSETS } from '@/theme/fonts';
import { navigationThemeFor } from '@/theme/navigation-theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 220, fade: true });
connectOnlineManager();
configureForegroundNotifications();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  useEffect(() => connectFocusManager(), []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AppThemeProvider>
            <QueryClientProvider client={queryClient}>
              <SessionProvider>
                <ToastProvider>
                  {/* Text is measured with the real faces only: render once fonts are in. */}
                  {fontsLoaded || fontError !== null ? <RootNavigator /> : null}
                  <NetworkBanner />
                </ToastProvider>
              </SessionProvider>
            </QueryClientProvider>
          </AppThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/** Routes are guarded by session state; the splash stays up until the session is known. */
function RootNavigator() {
  const { state } = useSession();
  const theme = useAppTheme();
  const settled = state.status !== 'restoring';
  useEffect(() => {
    if (settled) void SplashScreen.hideAsync();
  }, [settled]);
  return (
    <ThemeProvider value={navigationThemeFor(theme)}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: theme.colors.canvas },
        }}
      >
        <Stack.Protected guard={state.status === 'signedIn'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={state.status === 'signedOut' || state.status === 'restoring'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={state.status === 'unreachable'}>
          <Stack.Screen name="reconnect" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
