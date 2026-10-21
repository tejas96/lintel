import { ROLE_LABELS } from '@lintel/domain';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ListRow } from '@/components/list-row';
import { ScreenScroll } from '@/components/screen';
import { Section } from '@/components/section';
import { can } from '@/session/capabilities';
import { useCurrentUser, useSession } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';
import { PushSettings } from './push-settings';
import { QuietHours } from './quiet-hours';
import { SessionsList } from './sessions-list';

/** Profile, rewards, notifications, quiet hours, signed-in devices and sign out. */
export function AccountScreen() {
  const user = useCurrentUser();
  const { signOut, refreshUser } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const versionLine = `Lintel ${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? 'dev'}) · ${ROLE_LABELS[user.role]}`;
  const confirmSignOut = () =>
    Alert.alert(
      'Sign out of Lintel?',
      'This phone will stop getting notifications until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          },
        },
      ],
    );
  return (
    <ScreenScroll edge="stack" onRefresh={refreshUser}>
      <Card style={styles.profile}>
        <Avatar user={user} size={64} />
        <View style={styles.flex}>
          <AppText variant="displayMd">{user.fullName}</AppText>
          <AppText variant="body" tone="secondary">
            {user.designation ?? ROLE_LABELS[user.role]} · {user.organizationName}
          </AppText>
          <AppText variant="mono" tone="tertiary">
            {user.maskedPhone}
            {user.email ? ` · ${user.email}` : ''}
          </AppText>
        </View>
      </Card>
      <Button
        label="Edit profile"
        variant="secondary"
        icon="edit"
        onPress={() => router.push('/profile')}
        accessibilityHint="Change your name, email or designation"
      />
      {can(user, 'rewards.view_own') ? (
        <Section title="Recognition">
          <Card style={styles.group}>
            <ListRow
              icon="reward"
              title="Rewards"
              subtitle="What earns a reward, your results and any challenges"
              onPress={() => router.push('/rewards')}
            />
          </Card>
        </Section>
      ) : null}
      <Section title="Notifications">
        <Card style={styles.group}>
          <PushSettings />
          <QuietHours />
        </Card>
      </Section>
      <Section title="Signed in on">
        <Card style={styles.group}>
          <SessionsList />
        </Card>
      </Section>
      <Button
        label="Sign out"
        variant="danger"
        icon="signOut"
        size="lg"
        onPress={confirmSignOut}
        loading={signingOut}
      />
      <AppText variant="mono" tone="tertiary" align="center">
        {versionLine}
      </AppText>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  flex: { flex: 1, gap: 2 },
  group: { gap: SPACE.sm, paddingVertical: SPACE.sm },
});
