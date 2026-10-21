import type { ApprovalItem } from '@lintel/api-contracts';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AccountButton } from '@/components/account-button';
import { PageHeader, ScreenScroll } from '@/components/screen';
import { Section } from '@/components/section';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { pluralize } from '@/formatting/quantities';
import { useApprovals } from '@/queries/approval-queries';
import { SPACE } from '@/theme/layout';
import { listEntrance } from '@/theme/motion';
import { ApprovalRow } from './approval-row';

const GROUPS: readonly { readonly type: ApprovalItem['type']; readonly title: string }[] = [
  { type: 'deliverable_review', title: 'Deliverable reviews' },
  { type: 'task_review', title: 'Task reviews' },
  { type: 'leave_request', title: 'Leave requests' },
  { type: 'scope_change', title: 'Scope changes' },
  { type: 'priority_conflict', title: 'Priority conflicts' },
  { type: 'reward_review', title: 'Rewards' },
  { type: 'reassignment_request', title: 'Handover requests' },
];

/** Everything waiting for the viewer's decision, urgent first within each kind. */
export function ApprovalsScreen() {
  const approvals = useApprovals();
  const items = approvals.data ?? [];
  return (
    <ScreenScroll edge="tab" onRefresh={() => approvals.refetch()}>
      <PageHeader
        overline={approvals.data ? `${pluralize(items.length, 'decision')} waiting` : 'Decisions'}
        title="Approvals"
        trailing={<AccountButton />}
      />
      {approvals.isPending ? <SkeletonList count={3} label="Loading approvals" /> : null}
      {approvals.isError ? (
        <ErrorState
          error={approvals.error}
          subject="your approvals"
          onRetry={() => void approvals.refetch()}
        />
      ) : null}
      {approvals.isSuccess && items.length === 0 ? (
        <EmptyState
          icon="approvals"
          title="All caught up"
          message="Nothing is waiting for your decision. New reviews and leave requests will appear here."
        />
      ) : null}
      {GROUPS.map(({ type, title }) => {
        const group = items
          .filter((item) => item.type === type)
          .sort(
            (left, right) => Number(right.urgency === 'high') - Number(left.urgency === 'high'),
          );
        if (group.length === 0) return null;
        return (
          <Section key={type} title={title} meta={String(group.length)}>
            <View style={{ gap: SPACE.md }}>
              {group.map((item, index) => (
                <Animated.View key={`${item.type}-${item.id}`} entering={listEntrance(index)}>
                  <ApprovalRow item={item} />
                </Animated.View>
              ))}
            </View>
          </Section>
        );
      })}
    </ScreenScroll>
  );
}
