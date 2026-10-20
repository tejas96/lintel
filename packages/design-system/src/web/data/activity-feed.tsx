'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { listItemEnter } from '../motion/presets';
import { Avatar } from './avatar';

export interface ActivityEntry {
  readonly id: string;
  readonly summary: string;
  /** ISO instant. */
  readonly createdAt: string;
  readonly actor: { readonly fullName: string; readonly avatarHue: number } | null;
  /** Extra context under the summary (project chip, task link). */
  readonly context?: ReactNode;
}

interface ActivityFeedProps {
  readonly entries: readonly ActivityEntry[];
  /** Studio time zone, so "today" matches the studio's calendar. */
  readonly timeZone: string;
  readonly className?: string;
}

function dayKey(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

function dayHeading(key: string, todayKey: string, yesterdayKey: string, timeZone: string): string {
  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(new Date(`${key}T12:00:00Z`));
}

/** Activity grouped by studio day, newest first, joined by a quiet rule. */
export function ActivityFeed({ entries, timeZone, className }: ActivityFeedProps) {
  const now = Date.now();
  const todayKey = dayKey(new Date(now).toISOString(), timeZone);
  const yesterdayKey = dayKey(new Date(now - 86_400_000).toISOString(), timeZone);
  const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone });
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.createdAt, timeZone);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  let index = 0;
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {[...groups.entries()].map(([key, items]) => (
        <section key={key} aria-label={dayHeading(key, todayKey, yesterdayKey, timeZone)}>
          <h3 className="mb-3 type-label text-ink-faint">
            {dayHeading(key, todayKey, yesterdayKey, timeZone)}
          </h3>
          <ol className="relative flex flex-col">
            <span
              aria-hidden
              className="absolute top-3 bottom-3 left-[0.9375rem] w-px bg-hairline"
            />
            {items.map((entry) => {
              const position = index++;
              return (
                <motion.li
                  key={entry.id}
                  {...listItemEnter(position)}
                  className="relative flex gap-3 py-2"
                >
                  <span className="relative z-[1] rounded-full bg-surface p-0.5">
                    {entry.actor ? (
                      <Avatar
                        name={entry.actor.fullName}
                        hue={entry.actor.avatarHue}
                        size="xs"
                        decorative
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="block size-6 rounded-full border border-rule bg-sunken"
                      />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                    <p className="type-body-sm text-ink">
                      {entry.actor && <span className="font-medium">{entry.actor.fullName} </span>}
                      {entry.summary}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body-sm text-ink-faint">
                      <time dateTime={entry.createdAt} className="type-mono">
                        {time.format(new Date(entry.createdAt))}
                      </time>
                      {entry.context}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
