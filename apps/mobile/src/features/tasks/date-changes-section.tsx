import type { DateChangeRequest, TaskDateChanges } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Section } from '@/components/section';
import { fadeIn, layoutTransition } from '@/theme/motion';
import { DateChangeRequestCard } from './date-change-request-card';

function emptyMessage(changes: TaskDateChanges): string {
  if (changes.requestUnavailableReason) return changes.requestUnavailableReason;
  return changes.viewerCanRequest
    ? 'Won’t make the date? Ask the project manager for a new one, with the reason.'
    : 'No new date is waiting for a decision.';
}

/** Decided and withdrawn requests, folded away until asked for (or linked to). */
function EarlierRequests({
  past,
  linkedRequestId,
}: {
  readonly past: readonly DateChangeRequest[];
  readonly linkedRequestId: string | null;
}) {
  const linkedIsPast = past.some((request) => request.id === linkedRequestId);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (linkedIsPast) setShowHistory(true);
  }, [linkedIsPast]);
  if (past.length === 0) return null;
  return (
    <>
      <Button
        label={showHistory ? 'Hide earlier requests' : `Earlier requests (${past.length})`}
        variant="quiet"
        icon={showHistory ? 'chevronDown' : 'chevronRight'}
        accessibilityHint={showHistory ? 'Hides them' : 'Shows decided and withdrawn requests'}
        onPress={() => setShowHistory((shown) => !shown)}
        style={styles.toggle}
      />
      {showHistory
        ? past.map((request) => (
            <Animated.View key={request.id} entering={fadeIn} layout={layoutTransition}>
              <DateChangeRequestCard
                request={request}
                highlighted={request.id === linkedRequestId}
              />
            </Animated.View>
          ))
        : null}
    </>
  );
}

/**
 * New dates: the owner or a collaborator asks with a reason, the project
 * manager accepts or declines here, and earlier requests stay as history.
 * A link about one request (approvals, a notification) highlights it, opening
 * the history when it is already decided; `onPlaced` lets the screen scroll to it.
 */
export function DateChangesSection({
  taskId,
  changes,
  linkedRequestId,
  onPlaced,
}: {
  readonly taskId: string;
  readonly changes: TaskDateChanges | undefined;
  readonly linkedRequestId: string | null;
  readonly onPlaced: (y: number) => void;
}) {
  const router = useRouter();
  const requests = changes?.requests ?? [];
  const open = requests.find((request) => request.status === 'open') ?? null;
  const past = requests.filter((request) => request.status !== 'open');
  if (!changes) return null;
  if (!open && past.length === 0 && !changes.viewerCanRequest) return null;
  const ask = () => router.push({ pathname: '/tasks/[id]/new-date', params: { id: taskId } });

  return (
    <Animated.View
      entering={fadeIn}
      layout={layoutTransition}
      onLayout={(event) => onPlaced(event.nativeEvent.layout.y)}
    >
      <Section title="New date" meta={open ? '1 waiting' : undefined}>
        {open ? (
          <DateChangeRequestCard request={open} highlighted={open.id === linkedRequestId} />
        ) : (
          <AppText variant="bodySm" tone="secondary">
            {emptyMessage(changes)}
          </AppText>
        )}
        {!open && changes.viewerCanRequest ? (
          <Button label="Ask for a new date" icon="calendar" variant="secondary" onPress={ask} />
        ) : null}
        <EarlierRequests past={past} linkedRequestId={linkedRequestId} />
      </Section>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toggle: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
