import {
  type AddedTaskSchedule,
  existingStageSpans,
  fieldsToApply,
  isOpenTaskStatus,
  itemWillApply,
  type ProjectRole,
  type ProjectWorkflowSnapshot,
  planTemplateUpdate,
  scheduleAddedWork,
  type TemplateUpdateInput,
  type TemplateUpdatePlan,
} from '@lintel/domain';
import {
  type CalendarDate,
  type Clock,
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
} from '@lintel/shared';
import type { ApplicationStores } from '../common/unit-of-work';
import { businessToday } from '../projects/command-dependencies';
import type { TemplateRecord, TemplateVersionRecord } from '../templates/template.store';
import type { TemplateUpdateProject } from './template-update.store';

export interface TemplateUpdateContext {
  readonly project: TemplateUpdateProject;
  readonly template: TemplateRecord;
  readonly current: TemplateVersionRecord;
  readonly target: TemplateVersionRecord;
  readonly input: TemplateUpdateInput;
  readonly plan: TemplateUpdatePlan;
  /** Dates and people for the added tasks that can be added. */
  readonly schedule: ReadonlyMap<string, AddedTaskSchedule>;
  /** The first day each stage of the new version can hold work, by stage key. */
  readonly stageStarts: ReadonlyMap<string, CalendarDate>;
  readonly today: CalendarDate;
}

type Stores = Pick<ApplicationStores, 'templateUpdates' | 'templates' | 'settings' | 'projects'>;

/** The version a project follows and the newest published one of the same template, if newer. */
export async function templateVersionsOf(
  stores: Pick<ApplicationStores, 'templates'>,
  templateVersionId: string | null,
): Promise<{
  template: TemplateRecord;
  current: TemplateVersionRecord;
  latest: TemplateVersionRecord | null;
} | null> {
  if (!templateVersionId) return null;
  const current = await stores.templates.findVersion(templateVersionId);
  const template = current ? await stores.templates.findTemplate(current.templateId) : null;
  if (!current || !template) return null;
  const published = (await stores.templates.versionsOf(template.id)).filter(
    (version) => version.status === 'published' && version.versionNumber > current.versionNumber,
  );
  const latest = published.sort((left, right) => right.versionNumber - left.versionNumber)[0];
  return { template, current, latest: latest ?? null };
}

/** Who holds each project role: the manager, then the first member with each role. */
async function roleAssignees(
  stores: Pick<ApplicationStores, 'projects'>,
  project: TemplateUpdateProject,
): Promise<Map<ProjectRole, string>> {
  const assignees = new Map<ProjectRole, string>([['manager', project.managerUserId]]);
  for (const member of await stores.projects.members(project.id)) {
    if (!assignees.has(member.projectRole)) assignees.set(member.projectRole, member.userId);
  }
  return assignees;
}

function existingDueDates(snapshot: ProjectWorkflowSnapshot): Map<string, string | null> {
  return new Map(
    snapshot.tasks
      .filter((task) => task.templateKey !== null && task.status !== 'cancelled')
      .map((task) => [task.templateKey as string, task.dueDate]),
  );
}

/**
 * Loads everything a template update needs and works out the plan. Refuses
 * projects without a template, projects already on the newest version, and
 * targets that are no longer the newest (someone published again).
 */
export async function loadTemplateUpdate(
  stores: Stores,
  clock: Clock,
  projectId: string,
  targetVersionId: string,
  lock: boolean,
): Promise<TemplateUpdateContext> {
  const project = lock
    ? await stores.templateUpdates.projectForUpdate(projectId)
    : await stores.templateUpdates.project(projectId);
  if (!project) throw new NotFoundError('Project');
  const versions = await templateVersionsOf(stores, project.templateVersionId);
  if (!versions) {
    throw new PreconditionFailedError('This project was not created from a template.');
  }
  if (!versions.latest) {
    throw new PreconditionFailedError('This project already follows the newest published version.');
  }
  if (versions.latest.id !== targetVersionId) {
    throw new ConflictError(
      `Version ${versions.latest.versionNumber} is now the newest published version. Preview it again.`,
    );
  }
  const snapshot = await stores.templateUpdates.snapshot(projectId, lock);
  const input: TemplateUpdateInput = {
    project: snapshot,
    from: versions.current.definition,
    to: versions.latest.definition,
    calendar: await stores.settings.defaultCalendar(),
  };
  const plan = planTemplateUpdate(input);
  const today = await businessToday(stores, clock);
  const addable = plan.items.filter(
    (item) => item.kind === 'task' && item.change === 'added' && item.blocked === null,
  );
  const added = scheduleAddedWork({
    definition: input.to,
    addedKeys: addable.map((item) => item.templateKey),
    existingDueByKey: existingDueDates(snapshot),
    existingStageSpans: existingStageSpans(snapshot),
    earliestStart: today,
    calendar: input.calendar,
    assignees: await roleAssignees(stores, project),
  });
  return {
    ...versions,
    target: versions.latest,
    project,
    input,
    plan,
    schedule: added.tasks,
    stageStarts: added.stageStarts,
    today,
  };
}

/**
 * The latest due date among open work once the update applies with these
 * ticks: removed tasks drop out, moved dates move, added tasks join.
 */
export function forecastAfterUpdate(
  context: TemplateUpdateContext,
  ticked: ReadonlySet<string>,
): string | null {
  const byItemId = new Map(
    context.plan.items.filter((item) => item.itemId !== null).map((item) => [item.itemId, item]),
  );
  let latest: string | null = null;
  const consider = (date: string | null) => {
    if (date && (latest === null || date > latest)) latest = date;
  };
  for (const task of context.input.project.tasks) {
    if (!isOpenTaskStatus(task.status)) continue;
    const item = byItemId.get(task.id);
    const applies = item ? itemWillApply(item, ticked) : false;
    if (item?.change === 'removed' && applies) continue;
    const moved =
      item?.dates && fieldsToApply(item, ticked).some((field) => field.field === 'duration');
    consider(moved ? (item?.dates?.toDue ?? task.dueDate) : task.dueDate);
  }
  for (const [key, schedule] of context.schedule) {
    const item = context.plan.items.find((candidate) => candidate.key === `task:${key}`);
    if (item && itemWillApply(item, ticked)) consider(schedule.dueDate);
  }
  return latest;
}
