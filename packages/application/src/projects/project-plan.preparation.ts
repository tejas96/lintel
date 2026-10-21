import {
  isUntailored,
  NO_TAILORING,
  type PlanTailoring,
  type PlanTaskAdjustment,
  type ProjectWorkflowPlan,
} from '@lintel/domain';
import {
  type CalendarDate,
  type ErrorDetail,
  isCalendarDate,
  ValidationFailedError,
} from '@lintel/shared';
import type { ApplicationStores } from '../common/unit-of-work';
import type { TemplateRecord, TemplateVersionRecord } from '../templates/template.store';
import type { ProjectMemberInput } from './project.store';
import { normalizeMembers, requireActiveUsers } from './project-members.rules';
import {
  addedPlanKeys,
  assertValidTailoring,
  buildWorkflowPlan,
  planFromTemplate,
  singleStagePlan,
} from './project-plan.factory';
import type { NewProjectPlan } from './project-plan.types';

/** A tailoring as it arrives over HTTP: dates are plain "YYYY-MM-DD" strings. */
export type PlanTailoringInput = Omit<PlanTailoring, 'adjustments'> & {
  readonly adjustments: readonly (Omit<PlanTaskAdjustment, 'startDate'> & {
    readonly startDate?: string | null | undefined;
  })[];
};

export interface ProjectPlanInput {
  readonly managerUserId: string;
  readonly templateVersionId: string | null;
  readonly templateOptions: readonly string[];
  readonly members: readonly ProjectMemberInput[];
  readonly tailoring?: PlanTailoringInput | undefined;
}

/** Checks the dates of an incoming tailoring and gives the domain its typed form. */
export function toPlanTailoring(input: PlanTailoringInput | undefined): PlanTailoring {
  if (!input) return NO_TAILORING;
  const issues: ErrorDetail[] = [];
  const adjustments = input.adjustments.map((adjustment, index) => {
    const { startDate, ...rest } = adjustment;
    if (startDate && !isCalendarDate(startDate)) {
      issues.push({
        field: `tailoring.adjustments.${index}.startDate`,
        message: 'Use a real date in YYYY-MM-DD format.',
      });
    }
    return { ...rest, startDate: startDate && isCalendarDate(startDate) ? startDate : null };
  });
  if (issues.length > 0) throw new ValidationFailedError('Check the dates.', issues);
  return { ...input, adjustments };
}

export interface ChosenTemplate {
  readonly template: TemplateRecord;
  readonly version: TemplateVersionRecord;
}

export interface PreparedProjectPlan {
  readonly chosen: ChosenTemplate | null;
  /** The dated plan from the domain builder; null without a template. */
  readonly workflow: ProjectWorkflowPlan | null;
  readonly plan: NewProjectPlan;
  /** The team, including people given a task by hand (as members). */
  readonly members: ProjectMemberInput[];
  readonly tailoring: PlanTailoring;
}

type PlanStores = Pick<ApplicationStores, 'templates' | 'settings' | 'projects'>;

async function publishedTemplate(
  stores: PlanStores,
  versionId: string,
  options: readonly string[],
): Promise<ChosenTemplate> {
  const field = 'templateVersionId';
  const version = await stores.templates.findVersion(versionId);
  const template = version ? await stores.templates.findTemplate(version.templateId) : null;
  if (!version || !template || version.status !== 'published') {
    throw new ValidationFailedError('Choose a published template version.', [
      { field, message: 'This template version is not published.' },
    ]);
  }
  if (template.archivedAt) {
    throw new ValidationFailedError('This template is archived.', [
      { field, message: 'Archived templates cannot start new projects.' },
    ]);
  }
  const known = new Set(version.definition.options.map((option) => option.key));
  const unknown = options.filter((option) => !known.has(option));
  if (unknown.length > 0) {
    throw new ValidationFailedError(
      'Some template options do not exist.',
      unknown.map((option) => ({
        field: 'templateOptions',
        message: `"${option}" is not an option of this template.`,
      })),
    );
  }
  return { template, version };
}

/** People given a task by hand join the team as members when they are not on it yet. */
function withTaskOwners(
  members: readonly ProjectMemberInput[],
  tailoring: PlanTailoring,
): ProjectMemberInput[] {
  const onTeam = new Set(members.map((member) => member.userId));
  const added: ProjectMemberInput[] = [];
  for (const adjustment of tailoring.adjustments) {
    const userId = adjustment.ownerUserId;
    if (!userId || onTeam.has(userId)) continue;
    onTeam.add(userId);
    added.push({ userId, projectRole: 'member' });
  }
  return [...members, ...added];
}

/**
 * Everything a new project's plan depends on, checked and dated: the team,
 * the published template and its options, the tailoring, and the plan the
 * domain builder makes from them. Creating a project and previewing its plan
 * both call this, so the preview is exactly what will be created.
 */
export async function prepareProjectPlan(
  stores: PlanStores,
  input: ProjectPlanInput,
  startDate: CalendarDate,
): Promise<PreparedProjectPlan> {
  const tailoring = toPlanTailoring(input.tailoring);
  if (!input.templateVersionId && !isUntailored(tailoring)) {
    throw new ValidationFailedError('Choose a template before changing its plan.', [
      { field: 'tailoring', message: 'Only a template plan can be tailored.' },
    ]);
  }
  const members = withTaskOwners(normalizeMembers(input.managerUserId, input.members), tailoring);
  await requireActiveUsers(
    stores.projects,
    members.map((member) => member.userId),
  );
  if (!input.templateVersionId) {
    return { chosen: null, workflow: null, plan: singleStagePlan(startDate), members, tailoring };
  }
  const chosen = await publishedTemplate(stores, input.templateVersionId, input.templateOptions);
  assertValidTailoring(chosen.version.definition, tailoring, startDate);
  const workflow = buildWorkflowPlan({
    definition: chosen.version.definition,
    calendar: await stores.settings.defaultCalendar(),
    startDate,
    options: input.templateOptions,
    members,
    tailoring,
  });
  const plan = planFromTemplate(workflow, input.managerUserId, addedPlanKeys(tailoring));
  return { chosen, workflow, plan, members, tailoring };
}

/** "removed 2 tasks, added 1 stage, changed 3 dates, chose people for 2 tasks" — only what changed. */
export function describeTailoring(tailoring: PlanTailoring): string | null {
  const phrase = (verb: string, n: number, noun: string) =>
    n > 0 ? `${verb} ${n} ${noun}${n === 1 ? '' : 's'}` : null;
  const dates = tailoring.adjustments.filter((a) => a.startDate || a.durationDays).length;
  const people = tailoring.adjustments.filter((a) => a.ownerUserId !== undefined).length;
  const parts = [
    phrase('removed', tailoring.removedStageKeys.length, 'stage'),
    phrase('removed', tailoring.removedTaskKeys.length, 'task'),
    phrase('added', tailoring.addedStages.length, 'stage'),
    phrase('added', tailoring.addedTasks.length, 'task'),
    phrase('changed', dates, 'date'),
    phrase('chose people for', people, 'task'),
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(', ') : null;
}
