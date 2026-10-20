import { Stack } from 'expo-router';
import { useNotificationNavigation, usePushRegistration } from '@/push/use-push-lifecycle';
import { useForegroundHeartbeat } from '@/session/use-foreground-heartbeat';
import { useAppTheme } from '@/theme/app-theme';
import { fontFaceFor } from '@/theme/fonts';

/** Native sheet presentation for short, focused tasks (grabber, rounded top). */
function sheet(detents: number[] | 'fitToContents', surface: string) {
  return {
    presentation: 'formSheet' as const,
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
    headerShown: false,
    contentStyle: { backgroundColor: surface },
  };
}

/** Everything behind sign-in: the tabs plus detail screens and sheets pushed over them. */
export default function SignedInLayout() {
  usePushRegistration();
  useNotificationNavigation();
  useForegroundHeartbeat();
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: fontFaceFor('ui', 600), color: colors.textPrimary },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tasks/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="tasks/[id]/actions" options={sheet('fitToContents', colors.surface)} />
      <Stack.Screen name="tasks/[id]/blocker" options={sheet([0.7, 0.95], colors.surface)} />
      <Stack.Screen name="tasks/[id]/transition" options={sheet([0.55, 0.9], colors.surface)} />
      <Stack.Screen name="blockers/[id]/resolve" options={sheet([0.6, 0.9], colors.surface)} />
      <Stack.Screen name="projects/[id]" options={{ title: '' }} />
      <Stack.Screen name="deliverables/[id]" options={{ title: 'Deliverable' }} />
      <Stack.Screen name="leave/[id]" options={{ title: 'Leave request' }} />
      <Stack.Screen
        name="leave/new"
        options={{ presentation: 'modal', title: 'Request leave', headerShown: true }}
      />
      <Stack.Screen
        name="site-updates/new"
        options={{ presentation: 'modal', title: 'Site update', headerShown: true }}
      />
      <Stack.Screen name="account" options={{ title: 'Account' }} />
    </Stack>
  );
}
