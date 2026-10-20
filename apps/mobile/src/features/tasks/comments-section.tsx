import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { IconButton } from '@/components/icon-button';
import { Section } from '@/components/section';
import { InlineError } from '@/components/state-views';
import { useToast } from '@/feedback/toast';
import { formatRelativeInstant } from '@/formatting/dates';
import { useAddComment, useTaskComments } from '@/queries/task-queries';
import { useAppTheme } from '@/theme/app-theme';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/layout';
import { TEXT_STYLES } from '@/theme/typography';

/** The conversation on a task, oldest first, with a composer at the end. */
export function CommentsSection({ taskId }: { readonly taskId: string }) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const comments = useTaskComments(taskId);
  const addComment = useAddComment(taskId);
  const [draft, setDraft] = useState('');
  const send = () => {
    const body = draft.trim();
    if (!body || addComment.isPending) return;
    addComment.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  };
  const list = comments.data ?? [];
  return (
    <Section title="Comments" meta={list.length > 0 ? String(list.length) : undefined}>
      {comments.isError ? (
        <InlineError error={comments.error} onRetry={() => void comments.refetch()} />
      ) : null}
      {list.length === 0 && comments.isSuccess ? (
        <AppText variant="bodySm" tone="secondary">
          No comments yet. Ask a question or leave a note for the team.
        </AppText>
      ) : null}
      {list.map((comment) => (
        <View key={comment.id} style={styles.comment}>
          <Avatar user={comment.author} size={28} />
          <View style={styles.bubble}>
            <View style={styles.byline}>
              <AppText variant="label">{comment.author.fullName}</AppText>
              <AppText variant="mono" tone="tertiary">
                {formatRelativeInstant(comment.createdAt)}
                {comment.editedAt ? ' · edited' : ''}
              </AppText>
            </View>
            <AppText variant="body">{comment.body}</AppText>
          </View>
        </View>
      ))}
      <View
        style={[
          styles.composer,
          { borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          multiline
          maxLength={5000}
          accessibilityLabel="Comment"
          style={[TEXT_STYLES.body, styles.input, { color: colors.textPrimary }]}
        />
        <IconButton
          icon="send"
          accessibilityLabel="Send comment"
          onPress={send}
          disabled={!draft.trim() || addComment.isPending}
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  comment: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  bubble: { flex: 1, gap: 2 },
  byline: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm, flexWrap: 'wrap' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs,
    paddingVertical: SPACE.xs,
  },
  input: { flex: 1, minHeight: TOUCH_TARGET, maxHeight: 140, paddingTop: SPACE.md },
});
