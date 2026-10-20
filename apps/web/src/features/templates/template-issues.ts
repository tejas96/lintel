import type { ApiError } from '@/lib/api/api-error';
import type { WorkflowDefinition } from './template-types';

/** Where a server problem belongs in the editor. */
export type IssueTarget =
  | { readonly kind: 'general' }
  | { readonly kind: 'stage'; readonly stageKey: string; readonly field: string | null }
  | { readonly kind: 'milestone'; readonly milestoneKey: string; readonly field: string | null }
  | { readonly kind: 'task'; readonly taskKey: string; readonly field: string | null };

export interface TemplateIssue {
  readonly message: string;
  readonly target: IssueTarget;
}

const GENERAL: IssueTarget = { kind: 'general' };

/** A position inside a stage (tasks.0.title, milestones.1.name, name). */
function insideStage(
  stage: WorkflowDefinition['stages'][number],
  [part, index, field]: readonly (string | undefined)[],
): IssueTarget {
  if (part === 'tasks' && index !== undefined) {
    const task = stage.tasks[Number(index)];
    return task ? { kind: 'task', taskKey: task.key, field: field ?? null } : GENERAL;
  }
  if (part === 'milestones' && index !== undefined) {
    const milestone = stage.milestones[Number(index)];
    return milestone
      ? { kind: 'milestone', milestoneKey: milestone.key, field: field ?? null }
      : GENERAL;
  }
  return { kind: 'stage', stageKey: stage.key, field: part ?? null };
}

/**
 * Resolves one field path from the server to a place in the definition that
 * was sent. Schema problems arrive by position
 * ("definition.stages.2.tasks.0.title"); workflow rules arrive by key
 * ("definition.tasks.site-analysis").
 */
function targetOf(path: string, sent: WorkflowDefinition): IssueTarget {
  const [root, group, first, ...rest] = path.split('.');
  if (root !== 'definition' || first === undefined) return GENERAL;
  if (group === 'tasks') return { kind: 'task', taskKey: first, field: null };
  if (group === 'milestones') return { kind: 'milestone', milestoneKey: first, field: null };
  if (group !== 'stages') return GENERAL;
  const stage = /^\d+$/.test(first)
    ? sent.stages[Number(first)]
    : sent.stages.find((candidate) => candidate.key === first);
  return stage ? insideStage(stage, rest) : GENERAL;
}

/** Schema messages in plain words ("String must contain at least 2 character(s)"). */
function plainMessage(message: string): string {
  const atLeast = /at least (\d+) character/.exec(message)?.[1];
  if (atLeast) return `Use at least ${atLeast} characters.`;
  const atMost = /at most (\d+) character/.exec(message)?.[1];
  if (atMost) return `Use at most ${atMost} characters.`;
  const minimum = /greater than or equal to (\d+)/.exec(message)?.[1];
  if (minimum) return `Use ${minimum} or more.`;
  const maximum = /less than or equal to (\d+)/.exec(message)?.[1];
  if (maximum) return `Use ${maximum} or less.`;
  if (/Expected integer/.test(message)) return 'Use a whole number.';
  return message;
}

/** Every problem the server reported, each placed next to what it is about. */
export function issuesFrom(error: ApiError, sent: WorkflowDefinition): TemplateIssue[] {
  const detailed = error.details.map((detail) => ({
    message: plainMessage(detail.message),
    target: detail.field ? targetOf(detail.field, sent) : GENERAL,
  }));
  return detailed.length > 0 ? detailed : [{ message: error.message, target: GENERAL }];
}

/** Issues for one task, keyed by field ("title", "dependsOn", …); null holds the rest. */
export function taskIssues(issues: readonly TemplateIssue[], taskKey: string) {
  return issues.filter(
    (issue): issue is TemplateIssue & { target: Extract<IssueTarget, { kind: 'task' }> } =>
      issue.target.kind === 'task' && issue.target.taskKey === taskKey,
  );
}

/** How many problems sit inside a stage (its fields, milestones and tasks). */
export function stageIssueCount(
  issues: readonly TemplateIssue[],
  stage: WorkflowDefinition['stages'][number],
): number {
  const tasks = new Set(stage.tasks.map((task) => task.key));
  const milestones = new Set(stage.milestones.map((milestone) => milestone.key));
  return issues.filter(({ target }) => {
    if (target.kind === 'stage') return target.stageKey === stage.key;
    if (target.kind === 'task') return tasks.has(target.taskKey);
    if (target.kind === 'milestone') return milestones.has(target.milestoneKey);
    return false;
  }).length;
}

/** The first message for a field of a task, stage or milestone, for its Field. */
export function fieldMessage(
  issues: readonly TemplateIssue[],
  match: (target: IssueTarget) => boolean,
  field: string,
): string | undefined {
  return issues.find(
    (issue) => match(issue.target) && 'field' in issue.target && issue.target.field === field,
  )?.message;
}
