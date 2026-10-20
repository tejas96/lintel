import { useRouter } from 'expo-router';
import { useCurrentUser } from '@/session/session-provider';
import { Avatar } from './avatar';
import { PressableScale } from './pressable-scale';

/** The person's avatar in a tab header opens Account (profile, sessions, notifications). */
export function AccountButton() {
  const user = useCurrentUser();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Account and settings"
      onPress={() => router.push('/account')}
      hitSlop={6}
      pressedScale={0.92}
      style={{ padding: 2 }}
    >
      <Avatar user={user} size={40} />
    </PressableScale>
  );
}
