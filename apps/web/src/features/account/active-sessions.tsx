'use client';

import {
  Badge,
  Button,
  ErrorState,
  listItemEnter,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from '@lintel/design-system/web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { formatRelativeInstant } from '@/lib/format/dates';
import { useFailureToast } from '@/lib/query/use-failure-toast';

const sessionsKey = ['auth', 'sessions'] as const;

const SYSTEMS: readonly [RegExp, string][] = [
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X/, 'macOS'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
];

// Order matters: Edge and Chrome both mention Safari; Edge also mentions Chrome.
const BROWSERS: readonly [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/** "Chrome on macOS", "Lintel app on Android", from what the device told the server. */
export function describeDevice(client: 'web' | 'mobile', userAgent: string | null): string {
  const agent = userAgent ?? '';
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1];
  const app =
    client === 'mobile'
      ? 'Lintel app'
      : (BROWSERS.find(([pattern]) => pattern.test(agent))?.[1] ?? 'A browser');
  return system ? `${app} on ${system}` : app;
}

/** Where this person is signed in, and a way to sign out any other device. */
export function ActiveSessions() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const sessions = useQuery({
    queryKey: sessionsKey,
    queryFn: () => expectStatus(api.auth.listSessions(), 200),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => expectStatus(api.auth.revokeSession({ params: { id } }), 204),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionsKey });
      toast({
        tone: 'success',
        title: 'Signed out',
        description: 'That device needs a new code to get back in.',
      });
    },
    onError: (error) => fail(error, 'sign out that device', [sessionsKey]),
  });

  if (sessions.isPending) {
    return (
      <SkeletonGroup label="Loading your devices">
        <SkeletonText lines={3} />
      </SkeletonGroup>
    );
  }
  if (sessions.isError) {
    return (
      <ErrorState
        size="section"
        {...describeError(sessions.error, { resource: 'collection' })}
        onRetry={() => sessions.refetch()}
      />
    );
  }
  const ordered = [...sessions.data].sort((left, right) =>
    left.isCurrent === right.isCurrent
      ? right.lastSeenAt.localeCompare(left.lastSeenAt)
      : left.isCurrent
        ? -1
        : 1,
  );
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised">
      {ordered.map((session, index) => {
        const Icon = session.client === 'mobile' ? Smartphone : Monitor;
        return (
          <motion.li
            key={session.id}
            {...listItemEnter(index)}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <Icon aria-hidden className="size-5 shrink-0 text-ink-faint" strokeWidth={1.75} />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="flex flex-wrap items-center gap-2 type-body-sm font-medium text-ink">
                {describeDevice(session.client, session.userAgent)}
                {session.isCurrent && <Badge variant="accent">This device</Badge>}
              </p>
              <p className="type-body-sm text-ink-faint">
                Signed in {formatRelativeInstant(session.createdAt)}, last used{' '}
                {formatRelativeInstant(session.lastSeenAt)}
              </p>
            </div>
            {!session.isCurrent && (
              <Button
                size="sm"
                variant="quiet"
                pending={revoke.isPending && revoke.variables === session.id}
                onClick={() => revoke.mutate(session.id)}
              >
                Sign out
              </Button>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
