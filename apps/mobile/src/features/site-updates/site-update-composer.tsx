import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { fieldErrors, unshownErrorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ScreenScroll } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { SourceButtons } from '@/features/files/source-buttons';
import { useUploads } from '@/features/files/use-uploads';
import { useToast } from '@/feedback/toast';
import { useCreateSiteUpdate } from '@/queries/project-queries';
import { useAppTheme } from '@/theme/app-theme';
import { SPACE, TOUCH_TARGET } from '@/theme/layout';
import { PhotoStrip } from './photo-strip';
import { ProjectChooser } from './project-chooser';

const MAX_PHOTOS = 12;

/** Photos, a note and an issue flag, posted to a project's site log. */
export function SiteUpdateComposer() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const [projectId, setProjectId] = useState<string | null>(params.projectId ?? null);
  return (
    <>
      <Stack.Screen options={{ title: 'Site update' }} />
      {projectId ? (
        <ComposerForm
          projectId={projectId}
          onChangeProject={params.projectId ? null : () => setProjectId(null)}
        />
      ) : (
        <ScreenScroll edge="stack">
          <ProjectChooser onChoose={setProjectId} />
        </ScreenScroll>
      )}
    </>
  );
}

function ComposerForm({
  projectId,
  onChangeProject,
}: {
  readonly projectId: string;
  readonly onChangeProject: (() => void) | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useAppTheme();
  const create = useCreateSiteUpdate(projectId);
  const uploads = useUploads();
  const [note, setNote] = useState('');
  const [hasIssue, setHasIssue] = useState(false);
  const errors = fieldErrors(create.error);
  const remaining = MAX_PHOTOS - uploads.items.length;
  const ready = note.trim().length >= 3 && !uploads.busy;

  const submit = () =>
    create.mutate(
      {
        taskId: null,
        note: note.trim(),
        hasIssue,
        photoFileIds: uploads.uploaded.map((file) => file.id),
      },
      {
        onSuccess: () => {
          toast.show(
            hasIssue ? 'Update posted and the issue flagged.' : 'Site update posted.',
            'success',
          );
          router.back();
        },
        onError: (error) => {
          const message = unshownErrorMessage(error, ['note']);
          if (message) toast.show(message, 'error');
        },
      },
    );

  return (
    <ScreenScroll edge="stack">
      <View style={styles.form}>
        <AppText variant="bodySm" tone="secondary">
          Add photos from today, say what happened, and flag anything that needs the office.
        </AppText>
        <PhotoStrip items={uploads.items} onRetry={uploads.retry} onRemove={uploads.remove} />
        {remaining > 0 ? (
          <SourceButtons
            onPicked={(files) => void uploads.start(files.slice(0, remaining))}
            multiple
            limit={remaining}
            allowDocuments={false}
          />
        ) : null}
        <TextField
          label="What happened on site"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={2000}
          placeholder="e.g. False ceiling framing done in the living room; electrical conduits pending"
          error={errors.note ?? null}
        />
        <View style={styles.toggle}>
          <View style={styles.flex}>
            <AppText variant="body">Flag an issue</AppText>
            <AppText variant="bodySm" tone="secondary">
              The project manager is told straight away.
            </AppText>
          </View>
          <Switch
            value={hasIssue}
            onValueChange={setHasIssue}
            trackColor={{ true: colors.accent, false: colors.borderStrong }}
            accessibilityLabel="Flag an issue"
          />
        </View>
        <Button
          label={uploads.busy ? 'Uploading photos…' : 'Post update'}
          size="lg"
          onPress={submit}
          loading={create.isPending}
          disabled={!ready}
        />
        {onChangeProject ? (
          <Button label="Choose a different project" variant="quiet" onPress={onChangeProject} />
        ) : null}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACE.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: TOUCH_TARGET },
  flex: { flex: 1 },
});
