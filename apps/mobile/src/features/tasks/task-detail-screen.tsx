import { calendarDateInTimeZone } from '@lintel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { queryKeys } from '@/api/query-keys';
import { usePullToRefresh } from '@/components/screen';
import { SkeletonBlock, SkeletonGroup, SkeletonList } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { useTask } from '@/queries/task-queries';
import { useCurrentUser } from '@/session/session-provider';
import { useAppTheme } from '@/theme/app-theme';
import { GUTTER, MAX_CONTENT_WIDTH, SPACE } from '@/theme/layout';
import { AttachmentsSection } from './attachments-section';
import { BlockersSection } from './blockers-section';
import { ChecklistSection } from './checklist-section';
import { CommentsSection } from './comments-section';
import { TaskDeliverablesSection } from './deliverables-section';
import { DependenciesSection } from './dependencies-section';
import { TaskHeader } from './task-header';
import { TaskStatusActions } from './task-status-actions';
import { WorkSessionBar } from './work-session-bar';

/** Everything about one task, in the order people act on it. */
export function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const task = useTask(id);
  const queryClient = useQueryClient();
  // Refreshes the task and everything under it (comments, deliverables).
  const pull = usePullToRefresh(() =>
    queryClient.invalidateQueries({ queryKey: queryKeys.task(id) }),
  );
  const today = calendarDateInTimeZone(new Date(), user.timeZone);

  return (
    <>
      <Stack.Screen
        options={{
          title: task.data ? `${task.data.project.reference} · #${task.data.number}` : '',
        }}
      />
      <KeyboardAwareScrollView
        bottomOffset={SPACE.xl}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.canvas }}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: SPACE.md,
          paddingBottom: insets.bottom + SPACE.huge,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: MAX_CONTENT_WIDTH,
            alignSelf: 'center',
            gap: SPACE.xxl,
          }}
        >
          {task.isPending ? (
            <SkeletonGroup label="Loading task">
              <View style={{ gap: SPACE.md }}>
                <SkeletonBlock width="40%" height={12} />
                <SkeletonBlock height={30} />
                <SkeletonBlock width="70%" height={30} />
              </View>
            </SkeletonGroup>
          ) : null}
          {task.isPending ? <SkeletonList count={2} /> : null}
          {task.isError ? (
            <ErrorState
              error={task.error}
              subject="this task"
              onRetry={() => void task.refetch()}
            />
          ) : null}
          {task.data ? (
            <>
              <TaskHeader task={task.data} today={today} />
              <WorkSessionBar task={task.data} />
              <TaskStatusActions task={task.data} />
              <BlockersSection task={task.data} />
              <ChecklistSection task={task.data} />
              <TaskDeliverablesSection task={task.data} />
              <AttachmentsSection task={task.data} />
              <DependenciesSection task={task.data} />
              <CommentsSection taskId={task.data.id} />
            </>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}
