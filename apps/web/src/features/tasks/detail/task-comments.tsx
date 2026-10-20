'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { Avatar, Button, listItemEnter, SkeletonText, Textarea } from '@lintel/design-system/web';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { DetailSection } from './detail-section';
import { useTaskDetailMutations } from './use-task-detail-mutations';

/** The conversation on a task. Cmd/Ctrl+Enter posts. */
export function TaskComments({ taskId }: { readonly taskId: string }) {
  const comments = useQuery({
    queryKey: queryKeys.taskComments(taskId),
    queryFn: () => expectStatus(api.tasks.listComments({ params: { id: taskId } }), 200),
  });
  const { addComment } = useTaskDetailMutations(taskId);
  const [draft, setDraft] = useState('');

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    addComment.mutate(body, { onError: () => setDraft(body) });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
  };

  return (
    <DetailSection title="Comments" meta={comments.data ? String(comments.data.length) : undefined}>
      {comments.isPending && <SkeletonText lines={2} />}
      {comments.isError && (
        <p className="type-body-sm text-ink-faint">
          Comments couldn’t be loaded. They’ll appear when the connection is back.
        </p>
      )}
      {comments.data && comments.data.length === 0 && (
        <p className="type-body-sm text-ink-faint">
          No comments yet. Questions and decisions about this task belong here.
        </p>
      )}
      {comments.data && comments.data.length > 0 && (
        <ol className="flex flex-col gap-4">
          {comments.data.map((comment, index) => (
            <motion.li key={comment.id} {...listItemEnter(index)} className="flex gap-3">
              <Avatar
                name={comment.author.fullName}
                hue={comment.author.avatarHue}
                size="sm"
                decorative
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-baseline gap-x-2 type-body-sm">
                  <span className="font-medium text-ink">{comment.author.fullName}</span>
                  <time dateTime={comment.createdAt} className="text-ink-faint">
                    {comment.id.startsWith('pending-')
                      ? 'Sending…'
                      : formatRelativeInstant(comment.createdAt)}
                  </time>
                </p>
                <p className="whitespace-pre-wrap type-body text-ink">{comment.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Textarea
          aria-label="Write a comment"
          placeholder="Write a comment"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={5000}
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="self-end"
          disabled={!draft.trim()}
        >
          Comment
        </Button>
      </form>
    </DetailSection>
  );
}

/** Every move of the due date, with who moved it and why. */
export function ScheduleHistory({
  task,
  today,
}: {
  readonly task: TaskDetail;
  readonly today: string;
}) {
  if (task.scheduleChanges.length === 0) return null;
  const dated = (date: string | null) => (date ? formatCalendarDate(date, today) : 'no date');
  return (
    <DetailSection title="Schedule history">
      <ol className="flex flex-col gap-3 border-l border-hairline pl-4">
        {task.scheduleChanges.map((change) => (
          <li key={change.id} className="relative flex flex-col gap-0.5">
            <span
              aria-hidden
              className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full border border-rule bg-raised"
            />
            <p className="type-body-sm text-ink">
              Due date moved from {dated(change.previousDueDate)} to {dated(change.newDueDate)}
            </p>
            <p className="type-body-sm text-ink-muted">{change.reason}</p>
            <p className="type-body-sm text-ink-faint">
              {change.changedBy.fullName}, {formatRelativeInstant(change.createdAt)}
            </p>
          </li>
        ))}
      </ol>
    </DetailSection>
  );
}
