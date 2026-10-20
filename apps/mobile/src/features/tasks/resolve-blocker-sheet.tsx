import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { errorMessage, fieldErrors } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { SheetLayout } from '@/components/sheet-layout';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import { useResolveBlocker, useTask } from '@/queries/task-queries';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE, TOUCH_TARGET } from '@/theme/layout';

/** Close a blocker with what changed; optionally pick the work straight back up. */
export function ResolveBlockerSheet() {
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useAppTheme();
  const task = useTask(taskId);
  const resolve = useResolveBlocker();
  const [resolution, setResolution] = useState('');
  const [resumeWork, setResumeWork] = useState(true);
  const blocker = task.data?.blockers.find((candidate) => candidate.id === id);
  const errors = fieldErrors(resolve.error);
  const ready = resolution.trim().length >= 3;

  const submit = () =>
    resolve.mutate(
      { blockerId: id, resolution: resolution.trim(), resumeWork },
      {
        onSuccess: () => {
          toast.show('Blocker resolved.', 'success');
          router.back();
        },
        onError: (error) => {
          if (Object.keys(fieldErrors(error)).length === 0)
            toast.show(errorMessage(error), 'error');
        },
      },
    );

  return (
    <SheetLayout
      title="Resolve blocker"
      {...(blocker ? { subtitle: blocker.reason } : {})}
      footer={
        <Button
          label="Mark resolved"
          size="lg"
          onPress={submit}
          loading={resolve.isPending}
          disabled={!ready}
        />
      }
    >
      <TextField
        label="What changed?"
        value={resolution}
        onChangeText={setResolution}
        multiline
        autoFocus
        maxLength={2000}
        placeholder="e.g. Client approved the finish on call"
        error={errors.resolution ?? null}
      />
      <View style={styles.toggle}>
        <AppText variant="body" style={styles.flex}>
          Resume work on the task now
        </AppText>
        <Switch
          value={resumeWork}
          onValueChange={setResumeWork}
          trackColor={{ true: colors.accent, false: colors.borderStrong }}
          accessibilityLabel="Resume work on the task now"
        />
      </View>
    </SheetLayout>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: TOUCH_TARGET },
  flex: { flex: 1 },
});
