import { topologicalTaskOrder } from '../tasks/task-dependency-graph';
import type {
  TemplateTask,
  TemplateValidationIssue,
  WorkflowTemplateDefinition,
} from './workflow-template-definition';

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}

function uniqueKeyIssues(definition: WorkflowTemplateDefinition): TemplateValidationIssue[] {
  const groups: [string, string, string[]][] = [
    ['stages', 'Stage key', definition.stages.map((stage) => stage.key)],
    [
      'tasks',
      'Task key',
      definition.stages.flatMap((stage) => stage.tasks.map((task) => task.key)),
    ],
    [
      'milestones',
      'Milestone key',
      definition.stages.flatMap((s) => s.milestones.map((m) => m.key)),
    ],
  ];
  return groups.flatMap(([path, noun, keys]) =>
    duplicates(keys).map((key) => ({
      path: `${path}.${key}`,
      message: `${noun} "${key}" is used more than once.`,
    })),
  );
}

function taskIssues(
  task: TemplateTask,
  knownTasks: ReadonlySet<string>,
  knownMilestones: ReadonlySet<string>,
): TemplateValidationIssue[] {
  const path = `tasks.${task.key}`;
  const issues: TemplateValidationIssue[] = [];
  if (task.durationDays < 1) issues.push({ path, message: 'Duration must be at least one day.' });
  if (task.milestoneKey && !knownMilestones.has(task.milestoneKey)) {
    issues.push({ path, message: `Milestone "${task.milestoneKey}" does not exist.` });
  }
  for (const dependency of task.dependsOn.filter((key) => !knownTasks.has(key))) {
    issues.push({ path, message: `Dependency "${dependency}" does not exist.` });
  }
  if (task.requiresReview && !task.reviewerRole) {
    issues.push({ path, message: 'Reviewed tasks need a reviewer role.' });
  }
  return issues;
}

function hasDependencyLoop(
  tasks: readonly TemplateTask[],
  knownTasks: ReadonlySet<string>,
): boolean {
  const edges = tasks.flatMap((task) =>
    task.dependsOn
      .filter((dependency) => knownTasks.has(dependency))
      .map((dependency) => ({ taskId: task.key, dependsOnTaskId: dependency })),
  );
  return topologicalTaskOrder([...knownTasks], edges) === null;
}

/**
 * Checks the rules a schema cannot express: unique keys, references that
 * exist, and dependencies without loops. Returns every problem found.
 */
export function validateWorkflowTemplate(
  definition: WorkflowTemplateDefinition,
): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];
  if (definition.stages.length === 0) {
    issues.push({ path: 'stages', message: 'A template needs at least one stage.' });
  }
  issues.push(...uniqueKeyIssues(definition));
  const tasks = definition.stages.flatMap((stage) => stage.tasks);
  const knownTasks = new Set(tasks.map((task) => task.key));
  const knownMilestones = new Set(
    definition.stages.flatMap((stage) => stage.milestones.map((m) => m.key)),
  );
  for (const task of tasks) issues.push(...taskIssues(task, knownTasks, knownMilestones));
  if (hasDependencyLoop(tasks, knownTasks)) {
    issues.push({ path: 'tasks', message: 'Task dependencies form a loop.' });
  }
  return issues;
}
