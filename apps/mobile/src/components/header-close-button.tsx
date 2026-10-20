import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme/app-theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

/** "Cancel" for modal screens, so leaving never depends on discovering the swipe-down. */
export function HeaderCloseButton() {
  const router = useRouter();
  const { colors } = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      hitSlop={10}
      onPress={() => {
        if (router.canGoBack()) router.back();
      }}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
    >
      <AppText variant="body" color={colors.accent}>
        Cancel
      </AppText>
    </PressableScale>
  );
}
