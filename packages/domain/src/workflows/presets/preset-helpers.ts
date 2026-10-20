import type { ProjectRole } from '../../identity/roles';
import type { TaskPriority } from '../../tasks/task-status';
import type { TemplateTask } from '../workflow-template-definition';

interface PresetTaskOptions {
  readonly milestone?: string;
  readonly dependsOn?: readonly string[];
  readonly priority?: TaskPriority;
  readonly reviewBy?: ProjectRole;
  readonly checklist?: readonly string[];
  readonly optionalChecklist?: readonly string[];
  readonly deliverables?: readonly string[];
  readonly hoursPerDay?: number;
  readonly description?: string;
}

/** Compact way to write preset tasks. Estimates default to 5 focused hours per day. */
export function presetTask(
  key: string,
  title: string,
  responsibleRole: ProjectRole,
  durationDays: number,
  options: PresetTaskOptions = {},
): TemplateTask {
  const hoursPerDay = options.hoursPerDay ?? 5;
  return {
    key,
    title,
    responsibleRole,
    durationDays,
    estimateMinutes: durationDays * hoursPerDay * 60,
    dependsOn: options.dependsOn ?? [],
    priority: options.priority ?? 'medium',
    requiresReview: options.reviewBy !== undefined,
    ...(options.reviewBy ? { reviewerRole: options.reviewBy } : {}),
    ...(options.milestone ? { milestoneKey: options.milestone } : {}),
    ...(options.description ? { description: options.description } : {}),
    checklist: [
      ...(options.checklist ?? []).map((label) => ({ label, required: true })),
      ...(options.optionalChecklist ?? []).map((label) => ({ label, required: false })),
    ],
    deliverables: (options.deliverables ?? []).map((name) => ({ name, required: true })),
    escalateAfterOverdueDays: options.priority === 'urgent' ? 0 : 1,
  };
}
