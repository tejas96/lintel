import type { UserSummary } from '@lintel/api-contracts';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';
import { AppText } from './app-text';

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

export interface AvatarProps {
  readonly user: Pick<UserSummary, 'fullName' | 'avatarHue'>;
  readonly size?: number;
}

/** Initials on a muted tone derived from the person's stored hue. */
export function Avatar({ user, size = 32 }: AvatarProps) {
  const { scheme, colors } = useAppTheme();
  const hue = ((user.avatarHue % 360) + 360) % 360;
  const background = scheme === 'dark' ? `hsl(${hue}, 28%, 26%)` : `hsl(${hue}, 36%, 86%)`;
  const foreground = scheme === 'dark' ? `hsl(${hue}, 45%, 84%)` : `hsl(${hue}, 45%, 26%)`;
  return (
    <View
      accessible
      accessibilityLabel={user.fullName}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderColor: colors.surface,
        },
      ]}
    >
      <AppText
        variant="label"
        color={foreground}
        style={{ fontSize: Math.max(10, size * 0.38), lineHeight: size * 0.5 }}
        maxFontSizeMultiplier={1}
      >
        {initialsOf(user.fullName)}
      </AppText>
    </View>
  );
}

/** Overlapping avatars for collaborators, capped with a "+n". */
export function AvatarStack({
  users,
  size = 28,
  max = 3,
}: {
  readonly users: readonly Pick<UserSummary, 'id' | 'fullName' | 'avatarHue'>[];
  readonly size?: number;
  readonly max?: number;
}) {
  const { colors } = useAppTheme();
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <View style={styles.stack} accessibilityLabel={users.map((user) => user.fullName).join(', ')}>
      {shown.map((user, index) => (
        <View key={user.id} style={index > 0 ? { marginLeft: -size * 0.3 } : null}>
          <Avatar user={user} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <AppText
          variant="label"
          tone="secondary"
          style={{ marginLeft: 6, color: colors.textSecondary }}
        >
          +{extra}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  stack: { flexDirection: 'row', alignItems: 'center' },
});
