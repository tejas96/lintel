import type { WorkQueue, WorkQueueItem } from '@lintel/api-contracts';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Section } from '@/components/section';
import { SPACE } from '@/theme/layout';
import { layoutTransition, listEntrance } from '@/theme/motion';
import { QueueRow } from './queue-row';

type Bucket = WorkQueueItem['bucket'];

const BUCKETS: readonly { readonly bucket: Bucket; readonly title: string }[] = [
  { bucket: 'overdue', title: 'Overdue' },
  { bucket: 'today', title: 'Today' },
  { bucket: 'upcoming', title: 'Coming up' },
  { bucket: 'waiting', title: 'Waiting on others' },
  { bucket: 'blocked', title: 'Blocked' },
  { bucket: 'in_review', title: 'In review' },
  { bucket: 'later', title: 'Later' },
];

/** Buckets where the server says the work is yours to do now. */
const WORKABLE: ReadonlySet<Bucket> = new Set(['overdue', 'today', 'upcoming', 'later']);

export interface QueueSectionsProps {
  readonly queue: WorkQueue;
  readonly onStart: (taskId: string) => void;
}

/** The rest of the day in the server's order, grouped by the server's buckets. */
export function QueueSections({ queue, onStart }: QueueSectionsProps) {
  const rest = queue.items.filter((item) => item.task.id !== queue.next?.task.id);
  let position = 1;
  return (
    <View style={{ gap: SPACE.xxl }}>
      {BUCKETS.map(({ bucket, title }) => {
        const items = rest.filter((item) => item.bucket === bucket);
        if (items.length === 0) return null;
        return (
          <Section key={bucket} title={title} meta={String(items.length)}>
            <View style={{ gap: SPACE.md }}>
              {items.map((item) => (
                <Animated.View
                  key={item.task.id}
                  entering={listEntrance(position++)}
                  layout={layoutTransition}
                >
                  <QueueRow
                    item={item}
                    today={queue.today}
                    canStart={WORKABLE.has(bucket)}
                    onStart={onStart}
                  />
                </Animated.View>
              ))}
            </View>
          </Section>
        );
      })}
    </View>
  );
}
