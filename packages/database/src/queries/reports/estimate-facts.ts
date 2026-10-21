import {
  type EstimateFact,
  type InstantRange,
  type ReportPlan,
  reportInstantWindow,
} from '@lintel/application';
import { calendarDateInTimeZone } from '@lintel/shared';
import { and, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  projects,
  tasks,
  workflowTemplates,
  workflowTemplateVersions,
  workSessions,
} from '../../schema';
import type { ReportScope } from './report-scope';

/** An estimate fact with the task's own title, to name a task type that has no template name. */
export interface TitledEstimateFact extends EstimateFact {
  readonly title: string;
  readonly templateVersionId: string | null;
}

/** The task type key: the template key within the project's template. */
export function taskTypeKeyOf(templateId: string | null, templateKey: string | null) {
  return templateKey ? `${templateId ?? 'none'}:${templateKey}` : null;
}

/** Ended work sessions of everyone on these tasks, summed per task in whole minutes. */
async function loggedMinutesOf(
  db: DatabaseExecutor,
  taskIds: readonly string[],
): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map();
  const rows = await db
    .select({
      taskId: workSessions.taskId,
      startedAt: workSessions.startedAt,
      endedAt: workSessions.endedAt,
    })
    .from(workSessions)
    .where(and(inArray(workSessions.taskId, [...taskIds]), isNotNull(workSessions.endedAt)));
  const exact = new Map<string, number>();
  for (const row of rows) {
    if (!row.endedAt) continue;
    const minutes = Math.max(0, (row.endedAt.getTime() - row.startedAt.getTime()) / 60_000);
    exact.set(row.taskId, (exact.get(row.taskId) ?? 0) + minutes);
  }
  return new Map([...exact].map(([taskId, minutes]) => [taskId, Math.round(minutes)]));
}

/**
 * Done tasks (not archived) completed in the window on the scoped projects —
 * with the team filter, only those owned by team members — with their
 * estimate, their logged minutes and their place in the project's template.
 */
export async function estimateFacts(
  db: DatabaseExecutor,
  plan: ReportPlan,
  scope: ReportScope,
  timeZone: string,
): Promise<TitledEstimateFact[]> {
  if (scope.projectIds.length === 0) return [];
  const window: InstantRange = reportInstantWindow(plan.range, timeZone);
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      ownerUserId: tasks.ownerUserId,
      templateKey: tasks.templateKey,
      title: tasks.title,
      estimateMinutes: tasks.estimateMinutes,
      completedAt: tasks.completedAt,
      templateVersionId: projects.templateVersionId,
      templateId: workflowTemplateVersions.templateId,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(workflowTemplateVersions, eq(workflowTemplateVersions.id, projects.templateVersionId))
    .where(
      and(
        inArray(tasks.projectId, scope.projectIds),
        isNull(tasks.archivedAt),
        eq(tasks.status, 'done'),
        gte(tasks.completedAt, window.from),
        lt(tasks.completedAt, window.to),
        scope.teamUserIds ? inArray(tasks.ownerUserId, scope.teamUserIds) : undefined,
      ),
    );
  const logged = await loggedMinutesOf(
    db,
    rows.map((row) => row.id),
  );
  return rows.flatMap((row): TitledEstimateFact[] =>
    row.completedAt
      ? [
          {
            taskId: row.id,
            projectId: row.projectId,
            ownerUserId: row.ownerUserId,
            taskTypeKey: taskTypeKeyOf(row.templateId, row.templateKey),
            templateId: row.templateId,
            completedOn: calendarDateInTimeZone(row.completedAt, timeZone),
            estimateMinutes: row.estimateMinutes,
            loggedMinutes: logged.get(row.id) ?? 0,
            title: row.title,
            templateVersionId: row.templateVersionId,
          },
        ]
      : [],
  );
}

export interface TemplateNaming {
  /** Template names by template id. */
  readonly templates: ReadonlyMap<string, string>;
  /** The template's task titles by task type key (the newest version's wording wins). */
  readonly taskTitles: ReadonlyMap<string, string>;
}

/** Names of the templates behind these facts, and their task titles from the version definitions. */
export async function loadTemplateNaming(
  db: DatabaseExecutor,
  facts: readonly TitledEstimateFact[],
): Promise<TemplateNaming> {
  const versionIds = [
    ...new Set(facts.flatMap((fact) => (fact.templateVersionId ? [fact.templateVersionId] : []))),
  ];
  if (versionIds.length === 0) return { templates: new Map(), taskTitles: new Map() };
  const rows = await db
    .select({
      templateId: workflowTemplates.id,
      name: workflowTemplates.name,
      versionNumber: workflowTemplateVersions.versionNumber,
      definition: workflowTemplateVersions.definition,
    })
    .from(workflowTemplateVersions)
    .innerJoin(workflowTemplates, eq(workflowTemplates.id, workflowTemplateVersions.templateId))
    .where(inArray(workflowTemplateVersions.id, versionIds));
  const templates = new Map<string, string>();
  const taskTitles = new Map<string, string>();
  for (const row of [...rows].sort((left, right) => left.versionNumber - right.versionNumber)) {
    templates.set(row.templateId, row.name);
    for (const stage of row.definition.stages ?? []) {
      for (const task of stage.tasks ?? []) {
        const key = taskTypeKeyOf(row.templateId, task.key);
        if (key) taskTitles.set(key, task.title);
      }
    }
  }
  return { templates, taskTitles };
}

/** The most common title among the facts (ties: alphabetical), for task types without a template name. */
export function mostCommonTitle(facts: readonly { readonly title: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const fact of facts) counts.set(fact.title, (counts.get(fact.title) ?? 0) + 1);
  const [top] = [...counts].sort(
    ([leftTitle, left], [rightTitle, right]) => right - left || leftTitle.localeCompare(rightTitle),
  );
  return top?.[0] ?? null;
}
