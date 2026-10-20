import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/state-views';
import { useAppTheme } from '@/theme/app-theme';

/** A link the app has no screen for (e.g. an old notification). */
export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.canvas }}>
      <EmptyState
        icon="info"
        title="This page isn’t in the app"
        message="It may have moved, or it’s only available in Lintel on the web."
        actionLabel="Go to Today"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
