import { Alert, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { Divider } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { InlineError } from '@/components/state-views';
import { useToast } from '@/feedback/toast';
import { formatRelativeInstant } from '@/formatting/dates';
import { useRevokeSession, useSessions } from '@/queries/account-queries';

function deviceName(client: 'web' | 'mobile', userAgent: string | null): string {
  if (client === 'web') return 'Web browser';
  if (userAgent?.toLowerCase().includes('android')) return 'Android phone';
  if (userAgent && /iphone|ipad|ios|darwin|cfnetwork/i.test(userAgent)) return 'iPhone or iPad';
  return 'Mobile app';
}

/** Where the person is signed in; any other session can be signed out from here. */
export function SessionsList() {
  const toast = useToast();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  if (sessions.isPending) return <SkeletonList count={1} />;
  if (sessions.isError)
    return <InlineError error={sessions.error} onRetry={() => void sessions.refetch()} />;
  const confirm = (sessionId: string, name: string) =>
    Alert.alert(`Sign out ${name}?`, 'That device will need a new code to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () =>
          revoke.mutate(sessionId, {
            onSuccess: () => toast.show('Signed out that device.', 'success'),
            onError: (error) => toast.show(errorMessage(error), 'error'),
          }),
      },
    ]);
  return (
    <View>
      {sessions.data.map((session, index) => {
        const name = deviceName(session.client, session.userAgent);
        return (
          <View key={session.id}>
            {index > 0 ? <Divider inset={32} /> : null}
            <ListRow
              icon={session.client === 'web' ? 'openExternal' : 'device'}
              title={session.isCurrent ? `${name} (this device)` : name}
              subtitle={`Active ${formatRelativeInstant(session.lastSeenAt)} · since ${formatRelativeInstant(session.createdAt)}`}
              trailing={
                session.isCurrent ? null : (
                  <Button
                    label="Sign out"
                    variant="quiet"
                    loading={revoke.isPending && revoke.variables === session.id}
                    onPress={() => confirm(session.id, name)}
                  />
                )
              }
            />
          </View>
        );
      })}
    </View>
  );
}
