'use client';

import type { CoverSuggestions as CoverSuggestionsView } from '@lintel/api-contracts';
import { Avatar, Button, buttonStyles, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { useQuery } from '@tanstack/react-query';
import { UserRoundCheck } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { TaskNumber } from '@/features/tasks/task-presentation';
import { api, expectStatus } from '@/lib/api/api-client';
import { formatCalendarDate } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';

type TaskCover = CoverSuggestionsView['tasks'][number];

const hours = (minutes: number) => `${Math.round((Math.max(0, minutes) / 60) * 10) / 10} h`;

export function useCoverSuggestions(leaveRequestId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.coverSuggestions(leaveRequestId),
    queryFn: () =>
      expectStatus(api.insights.leaveCoverSuggestions({ params: { id: leaveRequestId } }), 200),
    enabled,
  });
}

function windowText(item: TaskCover, today: string): string {
  const { start, end } = item.window;
  const days =
    start === end
      ? formatCalendarDate(start, today)
      : `${formatCalendarDate(start, today)} to ${formatCalendarDate(end, today)}`;
  return `${days} · about ${hours(item.needMinutes)} of work then`;
}

function TaskSuggestions({
  item,
  today,
  onChoose,
}: {
  readonly item: TaskCover;
  readonly today: string;
  readonly onChoose: (taskId: string, userId: string) => void;
}) {
  const handover = item.handover && item.handover.status !== 'applied' ? item.handover : null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-4">
      <div className="flex flex-col gap-0.5">
        <Link
          href={`/tasks/${item.task.id}`}
          className="self-start rounded-sm type-body font-medium text-ink hover:underline"
        >
          <TaskNumber value={item.task.number} className="mr-1.5 font-normal" />
          {item.task.title}
        </Link>
        <p className="type-body-sm text-ink-muted">{windowText(item, today)}</p>
      </div>
      {item.handover?.status === 'applied' ? (
        <p className="type-body-sm text-ink-muted">
          Already handed over to {item.handover.to?.fullName ?? 'a colleague'}.
        </p>
      ) : item.suggestions.length === 0 ? (
        <p className="type-body-sm text-ink-faint">
          Nobody fits yet: no one on this project or with the same designation is working those
          days.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {item.suggestions.map((suggestion, index) => {
            const first = suggestion.user.fullName.split(' ')[0] ?? suggestion.user.fullName;
            return (
              <motion.li
                key={suggestion.user.id}
                {...listItemEnter(index)}
                className="flex flex-col gap-3 rounded-md bg-sunken/60 px-3 py-2.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <Avatar
                    name={suggestion.user.fullName}
                    hue={suggestion.user.avatarHue}
                    size="sm"
                    decorative
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 type-body-sm">
                      <span className="font-medium text-ink">{suggestion.user.fullName}</span>
                      {suggestion.user.designation && (
                        <span className="text-ink-faint">{suggestion.user.designation}</span>
                      )}
                      {suggestion.hasRoom && (
                        <StatusPill tone="onTrack" label="Has room" size="sm" />
                      )}
                    </p>
                    <p className="type-body-sm text-ink-muted">{suggestion.reasons.join(' · ')}</p>
                  </div>
                </div>
                {handover ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    leadingIcon={<UserRoundCheck aria-hidden />}
                    className="self-start sm:self-center"
                    onClick={() => onChoose(item.task.id, suggestion.user.id)}
                  >
                    Choose {first}
                  </Button>
                ) : (
                  <Link
                    href={`/tasks/${item.task.id}?assignTo=${suggestion.user.id}`}
                    className={buttonStyles({
                      variant: 'secondary',
                      size: 'sm',
                      className: 'self-start sm:self-center',
                    })}
                  >
                    <UserRoundCheck aria-hidden className="size-4" />
                    Assign to {first}
                  </Link>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Who could take each affected task while the person is away: same role or
 * designation, on the project, with free time on those days. Shown to the
 * project managers of the tasks; a choice opens the handover or the assign
 * sheet with the person picked. Nothing is reassigned by suggesting.
 */
export function CoverSuggestions({
  leaveRequestId,
  today,
  onChoose,
}: {
  readonly leaveRequestId: string;
  readonly today: string;
  readonly onChoose: (taskId: string, userId: string) => void;
}) {
  const cover = useCoverSuggestions(leaveRequestId, true);
  const tasks = cover.data?.tasks ?? [];
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="cover-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="cover-title" className="type-title-md text-ink">
          Who could cover
        </h2>
        <p className="type-body-sm text-ink-faint">
          Suggested from the same role or designation, the project team and free time on those days.
          You choose; nothing moves until you confirm.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {tasks.map((item) => (
          <TaskSuggestions key={item.task.id} item={item} today={today} onChoose={onChoose} />
        ))}
      </div>
    </section>
  );
}
