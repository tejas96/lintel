import type { Stage } from '@lintel/api-contracts';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/app-text';
import { type AppTheme, useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE } from '@/theme/layout';
import { timing } from '@/theme/motion';

function segmentColor(theme: AppTheme, status: Stage['status']): string {
  if (status === 'completed') return theme.status.onTrack.solid;
  if (status === 'active') return theme.colors.accent;
  return theme.colors.surfaceSunken;
}

const STATUS_WORD: Readonly<Record<Stage['status'], string>> = {
  completed: 'done',
  active: 'current',
  pending: 'not started',
  skipped: 'skipped',
};

function Segment({ stage, index }: { readonly stage: Stage; readonly index: number }) {
  const theme = useAppTheme();
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withDelay(index * 60, withTiming(1, timing('slow', 'outQuint'))));
  }, [fill, index]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  return (
    <View
      style={[
        styles.segment,
        { backgroundColor: theme.colors.surfaceSunken },
        stage.status === 'skipped'
          ? { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.borderStrong }
          : null,
      ]}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: segmentColor(theme, stage.status) }, fillStyle]}
      />
    </View>
  );
}

/** The project's workflow as a segmented bar: done, current and still to come. */
export function StageTracker({ stages }: { readonly stages: readonly Stage[] }) {
  const ordered = [...stages].sort((left, right) => left.position - right.position);
  const current = ordered.find((stage) => stage.status === 'active');
  const currentIndex = current ? ordered.indexOf(current) + 1 : null;
  const summary = ordered.map((stage) => `${stage.name}, ${STATUS_WORD[stage.status]}`).join('; ');
  if (ordered.length === 0) return null;
  return (
    <View style={styles.tracker} accessible accessibilityLabel={`Stages: ${summary}`}>
      <View style={styles.bar}>
        {ordered.map((stage, index) => (
          <Segment key={stage.id} stage={stage} index={index} />
        ))}
      </View>
      <AppText variant="bodySm" tone="secondary">
        {current && currentIndex
          ? `Stage ${currentIndex} of ${ordered.length} · ${current.name}`
          : ordered.every((stage) => stage.status === 'completed' || stage.status === 'skipped')
            ? 'All stages complete'
            : `${ordered.length} stages · not started`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tracker: { gap: SPACE.sm },
  bar: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: RADIUS.full, overflow: 'hidden' },
  fill: { flex: 1, transformOrigin: 'left' },
});
