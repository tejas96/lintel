import type { OwnProfile } from '@lintel/api-contracts';
import { ROLE_LABELS } from '@lintel/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, fieldErrors, unshownErrorMessage } from '@/api/api-error';
import { queryKeys } from '@/api/query-keys';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ScreenScroll } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import {
  type OwnProfileChanges,
  useOwnProfile,
  useUpdateOwnProfile,
} from '@/queries/account-queries';
import { useSession } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

function changesOf(
  profile: OwnProfile,
  values: Record<'fullName' | 'email' | 'designation', string>,
) {
  const changes: { -readonly [K in keyof OwnProfileChanges]: OwnProfileChanges[K] } = {};
  if (values.fullName.trim() !== profile.fullName) changes.fullName = values.fullName.trim();
  if (orNull(values.email) !== profile.email) changes.email = orNull(values.email);
  if (orNull(values.designation) !== profile.designation)
    changes.designation = orNull(values.designation);
  return changes;
}

/** Edit your own name, email and designation. Role, team and number stay with the studio. */
export function EditProfileScreen() {
  const profile = useOwnProfile();
  if (profile.data) return <ProfileForm key={profile.data.version} profile={profile.data} />;
  return (
    <ScreenScroll edge="stack">
      {profile.isError ? (
        <ErrorState
          error={profile.error}
          subject="your profile"
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <SkeletonList count={3} />
      )}
    </ScreenScroll>
  );
}

function ProfileForm({ profile }: { readonly profile: OwnProfile }) {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useAppTheme();
  const { refreshUser } = useSession();
  const queryClient = useQueryClient();
  const update = useUpdateOwnProfile();
  const [values, setValues] = useState({
    fullName: profile.fullName,
    email: profile.email ?? '',
    designation: profile.designation ?? '',
  });
  const changes = changesOf(profile, values);
  const errors = fieldErrors(update.error);
  const nameError = values.fullName.trim().length < 2 ? 'Enter your name.' : null;
  const save = () =>
    update.mutate(
      { changes, version: profile.version },
      {
        onSuccess: () => {
          void refreshUser();
          toast.show('Profile saved.', 'success');
          if (router.canGoBack()) router.back();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'STALE_VERSION') {
            void queryClient.invalidateQueries({ queryKey: queryKeys.ownProfile });
            toast.show('Your profile changed somewhere else. The latest is loaded.', 'info');
            return;
          }
          const message = unshownErrorMessage(error, ['fullName', 'email', 'designation']);
          if (message) toast.show(message, 'error');
        },
      },
    );

  return (
    <ScreenScroll edge="stack">
      <View style={styles.fields}>
        <TextField
          label="Full name"
          value={values.fullName}
          onChangeText={(fullName) => setValues({ ...values, fullName })}
          autoComplete="name"
          textContentType="name"
          maxLength={200}
          error={errors.fullName ?? nameError}
        />
        <TextField
          label="Email (optional)"
          hint="Colleagues see it in the directory."
          value={values.email}
          onChangeText={(email) => setValues({ ...values, email })}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={200}
          error={errors.email ?? null}
        />
        <TextField
          label="Designation"
          hint="For example: Interior designer"
          value={values.designation}
          onChangeText={(designation) => setValues({ ...values, designation })}
          maxLength={120}
          error={errors.designation ?? null}
        />
      </View>
      <Card tone="surface" style={styles.managed}>
        <View style={styles.managedTitle}>
          <Icon name="lock" size={14} color={colors.textSecondary} />
          <AppText variant="label" tone="secondary">
            Set by your studio
          </AppText>
        </View>
        <AppText variant="body">
          {ROLE_LABELS[profile.role]} · {profile.team?.name ?? 'No team'}
        </AppText>
        <AppText variant="mono" tone="secondary">
          {profile.maskedPhone}
        </AppText>
        <AppText variant="bodySm" tone="tertiary">
          To change your role, team or number, ask a studio administrator.
        </AppText>
      </Card>
      <Button
        label="Save profile"
        size="lg"
        onPress={save}
        loading={update.isPending}
        disabled={Object.keys(changes).length === 0 || nameError !== null}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  fields: { gap: SPACE.lg },
  managed: { gap: SPACE.xs },
  managedTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});
