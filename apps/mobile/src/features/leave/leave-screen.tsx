import type { LeaveRequest } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { isNotFound } from '@/api/api-error';
import { AccountButton } from '@/components/account-button';
import { Button } from '@/components/button';
import { PageHeader } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { TabList } from '@/components/tab-list';
import { type LeaveScope, useLeaveBalances, useLeaveRequests } from '@/queries/leave-queries';
import { can } from '@/session/capabilities';
import { useCurrentUser } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE } from '@/theme/layout';
import { LeaveBalances } from './leave-balances';
import { LeaveRequestRow } from './leave-request-row';

/** Balances, "Request leave", and either my requests or the ones waiting on me. */
export function LeaveScreen() {
  const user = useCurrentUser();
  const router = useRouter();
  const { colors } = useAppTheme();
  const decides = can(user, 'leave.approve_team') || can(user, 'leave.approve_any');
  const [scope, setScope] = useState<LeaveScope>('mine');
  const balances = useLeaveBalances();
  const requests = useLeaveRequests(scope);
  const items = requests.data?.pages.flatMap((page) => page.items) ?? [];

  const placeholder = requests.isPending ? (
    <SkeletonList count={3} label="Loading leave requests" />
  ) : requests.isError ? (
    <ErrorState
      error={requests.error}
      subject="leave requests"
      onRetry={() => void requests.refetch()}
    />
  ) : scope === 'mine' ? (
    <EmptyState
      icon="leave"
      title="No leave requests yet"
      message="When you request time off, it will appear here with its status."
    />
  ) : (
    <EmptyState
      icon="done"
      title="Nothing to decide"
      message="No one is waiting on you for a leave decision."
    />
  );

  return (
    <TabList<LeaveRequest>
      data={items}
      keyExtractor={(request) => request.id}
      renderItem={({ item }) => <LeaveRequestRow request={item} showPerson={scope !== 'mine'} />}
      header={
        <>
          <PageHeader overline="Time off" title="Leave" trailing={<AccountButton />} />
          {balances.data ? <LeaveBalances balances={balances.data} /> : null}
          {balances.isPending ? <SkeletonList count={1} /> : null}
          {balances.isError && !isNotFound(balances.error) ? (
            <ErrorState
              error={balances.error}
              subject="your balances"
              onRetry={() => void balances.refetch()}
            />
          ) : null}
          <Button
            label="Request leave"
            icon="add"
            size="lg"
            onPress={() => router.push('/leave/new')}
          />
          {decides ? (
            <View style={{ gap: SPACE.sm }}>
              <SegmentedControl
                accessibilityLabel="Which requests"
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'mine', label: 'My requests' },
                  { value: 'to_decide', label: 'To decide' },
                ]}
              />
            </View>
          ) : null}
        </>
      }
      placeholder={placeholder}
      onRefresh={() => Promise.all([requests.refetch(), balances.refetch()])}
      onEndReached={() => {
        if (requests.hasNextPage && !requests.isFetchingNextPage) void requests.fetchNextPage();
      }}
      footer={requests.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : null}
    />
  );
}
