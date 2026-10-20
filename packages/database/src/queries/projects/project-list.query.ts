import type { ProjectHealthStatus, ProjectStatus, ProjectType } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects } from '../../schema';
import { loadProjectSummaries } from '../shared/project-summary.query';
import { type ProjectListItemView, toListItem } from './project-detail.query';

export interface ProjectListFilter {
  /** From ProjectAccessService.visibleProjectIds. */
  readonly visibleProjectIds: readonly string[] | 'all';
  readonly search?: string | undefined;
  readonly status: 'open' | 'all' | ProjectStatus;
  readonly health?: ProjectHealthStatus | undefined;
  readonly managerUserId?: string | undefined;
  readonly projectType?: ProjectType | undefined;
  readonly sort: 'name' | 'plannedEndDate' | 'health' | 'createdAt';
  readonly direction: 'asc' | 'desc';
  readonly page: number;
  readonly pageSize: number;
  readonly today: CalendarDate;
}

const OPEN_PROJECT_STATUSES: ProjectStatus[] = ['draft', 'active', 'on_hold'];

/** Ascending health sort puts the projects that need attention first. */
const HEALTH_RANK: Readonly<Record<ProjectHealthStatus, number>> = {
  off_track: 0,
  at_risk: 1,
  on_track: 2,
  not_started: 3,
  closed: 4,
};

/** Health is computed, not stored: filter/sort it over the candidate set (studio scale). */
const HEALTH_CANDIDATE_LIMIT = 5000;

function conditions(filter: ProjectListFilter): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (filter.visibleProjectIds !== 'all') {
    parts.push(
      filter.visibleProjectIds.length > 0
        ? inArray(projects.id, [...filter.visibleProjectIds])
        : sql`false`,
    );
  }
  if (filter.status === 'open') parts.push(inArray(projects.status, OPEN_PROJECT_STATUSES));
  else if (filter.status !== 'all') parts.push(eq(projects.status, filter.status));
  if (filter.managerUserId) parts.push(eq(projects.managerUserId, filter.managerUserId));
  if (filter.projectType) parts.push(eq(projects.projectType, filter.projectType));
  const search = filter.search?.replace(/[%_\\]/g, '').trim();
  if (search) {
    const pattern = `%${search}%`;
    parts.push(
      or(
        ilike(projects.name, pattern),
        ilike(projects.clientName, pattern),
        ilike(projects.reference, pattern),
      ),
    );
  }
  return and(...parts);
}

function ordering(filter: ProjectListFilter): SQL[] {
  const direction = filter.direction === 'asc' ? asc : desc;
  switch (filter.sort) {
    case 'name':
      return [direction(projects.name), asc(projects.id)];
    case 'createdAt':
      return [direction(projects.createdAt), asc(projects.id)];
    case 'plannedEndDate':
      return [direction(projects.plannedEndDate), asc(projects.name), asc(projects.id)];
    case 'health':
      return [asc(projects.plannedEndDate), asc(projects.name), asc(projects.id)];
  }
}

/** Projects the viewer may see, filtered, sorted and paginated, with live health. */
export async function queryProjects(
  db: DatabaseExecutor,
  filter: ProjectListFilter,
): Promise<{ items: ProjectListItemView[]; totalItems: number }> {
  const where = conditions(filter);
  const offset = (filter.page - 1) * filter.pageSize;
  if (filter.health === undefined && filter.sort !== 'health') {
    const [totals, summaries] = await Promise.all([
      db.select({ total: count() }).from(projects).where(where),
      loadProjectSummaries(db, {
        where,
        orderBy: ordering(filter),
        limit: filter.pageSize,
        offset,
        today: filter.today,
      }),
    ]);
    return { items: summaries.map(toListItem), totalItems: totals[0]?.total ?? 0 };
  }
  const candidates = await loadProjectSummaries(db, {
    where,
    orderBy: ordering(filter),
    limit: HEALTH_CANDIDATE_LIMIT,
    today: filter.today,
  });
  const matching = filter.health
    ? candidates.filter((project) => project.health.status === filter.health)
    : candidates;
  const sign = filter.direction === 'asc' ? 1 : -1;
  const sorted =
    filter.sort === 'health'
      ? [...matching].sort(
          (a, b) => sign * (HEALTH_RANK[a.health.status] - HEALTH_RANK[b.health.status]),
        )
      : matching;
  return {
    items: sorted.slice(offset, offset + filter.pageSize).map(toListItem),
    totalItems: sorted.length,
  };
}
