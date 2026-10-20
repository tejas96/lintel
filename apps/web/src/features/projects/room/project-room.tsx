'use client';

import { ErrorState, pageEnter, Skeleton, SkeletonGroup, TabNav } from '@lintel/design-system/web';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { ProjectHeader } from './project-header';
import { useProject } from './use-project-room';

const TABS = [
  { segment: '', label: 'Overview' },
  { segment: '/board', label: 'Board' },
  { segment: '/timeline', label: 'Timeline' },
  { segment: '/list', label: 'List' },
  { segment: '/deliverables', label: 'Deliverables' },
  { segment: '/scope', label: 'Scope changes' },
  { segment: '/activity', label: 'Activity' },
] as const;

/** The project control room: title block and stage tracker above routed tabs. */
export function ProjectRoom({
  projectId,
  children,
}: {
  readonly projectId: string;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useSession();
  const project = useProject(projectId);
  const base = `/projects/${projectId}`;
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-5 py-6 md:px-10 md:py-9">
      <Link
        href="/projects"
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-sm type-body-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Projects
      </Link>
      {project.isPending && (
        <SkeletonGroup label="Loading the project" className="flex flex-col gap-4">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-11 w-2/3" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-2 w-full" />
        </SkeletonGroup>
      )}
      {project.isError && (
        <ErrorState
          {...describeError(project.error, { resource: 'item', noun: 'project' })}
          onRetry={() => project.refetch()}
          retrying={project.isFetching}
        />
      )}
      {project.data && (
        <>
          <motion.div {...pageEnter}>
            <ProjectHeader project={project.data} today={todayIn(user.timeZone)} />
          </motion.div>
          <TabNav
            label="Project sections"
            link={Link}
            items={TABS.map((tab) => ({
              href: `${base}${tab.segment}`,
              label: tab.label,
              active:
                tab.segment === ''
                  ? pathname === base
                  : pathname.startsWith(`${base}${tab.segment}`),
            }))}
          />
          <div className="min-w-0">{children}</div>
        </>
      )}
    </div>
  );
}
