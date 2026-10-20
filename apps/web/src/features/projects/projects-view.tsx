'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  pageEnter,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { ProjectCard } from './project-card';
import { ProjectsFilterBar } from './projects-filter-bar';
import { ProjectsTable } from './projects-table';
import { useProjectFilters, useProjectList } from './use-project-list';

function ProjectsSkeleton() {
  return (
    <SkeletonGroup label="Loading projects" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((card) => (
        <Skeleton key={card} className="h-72 rounded-lg" />
      ))}
    </SkeletonGroup>
  );
}

export function ProjectsView() {
  const { user, can } = useSession();
  const [filters, setFilters] = useProjectFilters();
  const projects = useProjectList(filters);
  const today = todayIn(user.timeZone);
  const filtered =
    filters.search !== '' ||
    filters.status !== 'open' ||
    filters.health !== 'any' ||
    filters.projectType !== 'any';
  const data = projects.data;
  const canCreate = can('projects.create');

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Projects"
          description={
            data
              ? `${data.totalItems} ${data.totalItems === 1 ? 'project' : 'projects'}${filtered ? ' match these filters' : ' in progress or planned'}.`
              : 'Every project you can see, with its health and stage.'
          }
          actions={
            canCreate && (
              <Button asChild variant="primary">
                <Link href="/projects/new">
                  <Plus aria-hidden className="size-4" />
                  New project
                </Link>
              </Button>
            )
          }
        />
      </motion.div>
      <ProjectsFilterBar filters={filters} onChange={setFilters} />
      {projects.isPending && <ProjectsSkeleton />}
      {projects.isError && !data && (
        <ErrorState
          {...describeError(projects.error, { resource: 'collection' })}
          onRetry={() => projects.refetch()}
          retrying={projects.isFetching}
        />
      )}
      {data &&
        data.items.length === 0 &&
        (filtered ? (
          <EmptyState
            drawing="plan"
            title="No projects match these filters"
            description="Try a different search, or clear the filters to see every open project."
            actions={
              <Button
                onClick={() =>
                  setFilters({ search: '', status: 'open', health: 'any', projectType: 'any' })
                }
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            drawing="drafting"
            title="No projects yet"
            description={
              canCreate
                ? 'Start one from a template and Lintel lays out its stages, tasks and dates for you.'
                : 'Projects you are added to will appear here.'
            }
            actions={
              canCreate && (
                <Button asChild variant="primary">
                  <Link href="/projects/new">Create the first project</Link>
                </Button>
              )
            }
          />
        ))}
      {data && data.items.length > 0 && (
        <div
          className={
            projects.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'
          }
        >
          {filters.view === 'cards' ? (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((project, index) => (
                <ProjectCard key={project.id} project={project} today={today} index={index} />
              ))}
            </ul>
          ) : (
            <ProjectsTable projects={data.items} today={today} />
          )}
        </div>
      )}
      {data && data.totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ page: filters.page - 1 })}
          >
            Previous
          </Button>
          <span className="type-body-sm text-ink-muted tabular-nums">
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={filters.page >= data.totalPages}
            onClick={() => setFilters({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
