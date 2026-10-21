import type { CalendarDate } from '@lintel/shared';
import { topologicalTaskOrder } from '../tasks/task-dependency-graph';
import { MAX_TAILORED_DURATION_DAYS, type PlanTailoring, tailorDefinition } from './plan-tailoring';
import type {
  TemplateValidationIssue,
  WorkflowTemplateDefinition,
} from './workflow-template-definition';

type Issue = TemplateValidationIssue;

function durationIssue(path: string, days: number): Issue | null {
  return Number.isInteger(days) && days >= 1 && days <= MAX_TAILORED_DURATION_DAYS
    ? null
    : {
        path,
        message: `Use a whole number of working days from 1 to ${MAX_TAILORED_DURATION_DAYS}.`,
      };
}

function keyIssues(definition: WorkflowTemplateDefinition, tailoring: PlanTailoring): Issue[] {
  const stageKeys = new Set(definition.stages.map((stage) => stage.key));
  const taskKeys = new Set(definition.stages.flatMap((stage) => stage.tasks.map((t) => t.key)));
  const issues: Issue[] = [];
  tailoring.removedStageKeys.forEach((key, index) => {
    if (!stageKeys.has(key))
      issues.push({
        path: `removedStageKeys.${index}`,
        message: 'This stage is not in the template.',
      });
  });
  tailoring.removedTaskKeys.forEach((key, index) => {
    if (!taskKeys.has(key))
      issues.push({
        path: `removedTaskKeys.${index}`,
        message: 'This task is not in the template.',
      });
  });
  const taken = new Set([...stageKeys, ...taskKeys]);
  const addedKeys = [
    ...tailoring.addedStages.map((stage, index) => ({
      key: stage.key,
      path: `addedStages.${index}.key`,
    })),
    ...tailoring.addedTasks.map((task, index) => ({
      key: task.key,
      path: `addedTasks.${index}.key`,
    })),
  ];
  for (const { key, path } of addedKeys) {
    // Subtasks are keyed "parent#1": an added key with "#" could take one's place.
    if (key.includes('#')) issues.push({ path, message: 'A key cannot contain "#".' });
    else if (taken.has(key))
      issues.push({ path, message: 'This key is already used in the plan.' });
    taken.add(key);
  }
  return issues;
}

function additionIssues(tailored: WorkflowTemplateDefinition, tailoring: PlanTailoring): Issue[] {
  const stages = new Set(tailored.stages.map((stage) => stage.key));
  const tasks = new Set(tailored.stages.flatMap((stage) => stage.tasks.map((task) => task.key)));
  const issues: Issue[] = [];
  tailoring.addedStages.forEach((stage, index) => {
    if (stage.name.trim().length < 2)
      issues.push({ path: `addedStages.${index}.name`, message: 'Give the stage a name.' });
  });
  tailoring.addedTasks.forEach((task, index) => {
    const path = `addedTasks.${index}`;
    if (task.title.trim().length < 2)
      issues.push({ path: `${path}.title`, message: 'Give the task a title.' });
    if (!stages.has(task.stageKey))
      issues.push({ path: `${path}.stageKey`, message: 'Choose a stage that stays in the plan.' });
    const duration = durationIssue(`${path}.durationDays`, task.durationDays);
    if (duration) issues.push(duration);
    task.dependsOn.forEach((key, position) => {
      if (!tasks.has(key) || key === task.key)
        issues.push({
          path: `${path}.dependsOn.${position}`,
          message: 'Wait only for other tasks that stay in the plan.',
        });
    });
  });
  return issues;
}

function adjustmentIssues(
  tailored: WorkflowTemplateDefinition,
  tailoring: PlanTailoring,
  projectStartDate: CalendarDate,
): Issue[] {
  const tasks = new Set(tailored.stages.flatMap((stage) => stage.tasks.map((task) => task.key)));
  const seen = new Set<string>();
  const issues: Issue[] = [];
  tailoring.adjustments.forEach((adjustment, index) => {
    const path = `adjustments.${index}`;
    if (!tasks.has(adjustment.taskKey)) {
      issues.push({ path: `${path}.taskKey`, message: 'This task is not in the plan.' });
      return;
    }
    if (seen.has(adjustment.taskKey))
      issues.push({ path: `${path}.taskKey`, message: 'This task is changed more than once.' });
    seen.add(adjustment.taskKey);
    if (adjustment.durationDays !== undefined && adjustment.durationDays !== null) {
      const duration = durationIssue(`${path}.durationDays`, adjustment.durationDays);
      if (duration) issues.push(duration);
    }
    if (adjustment.startDate && adjustment.startDate < projectStartDate) {
      issues.push({
        path: `${path}.startDate`,
        message: 'Start on or after the project start date.',
      });
    }
  });
  return issues;
}

function loopIssues(tailored: WorkflowTemplateDefinition): Issue[] {
  const tasks = tailored.stages.flatMap((stage) => stage.tasks);
  const keys = new Set(tasks.map((task) => task.key));
  const edges = tasks.flatMap((task) =>
    task.dependsOn
      .filter((key) => keys.has(key))
      .map((key) => ({ taskId: task.key, dependsOnTaskId: key })),
  );
  return topologicalTaskOrder([...keys], edges) === null
    ? [{ path: 'addedTasks', message: 'These waits would form a loop. Remove one of them.' }]
    : [];
}

/**
 * Problems with a tailoring, each with the field it concerns: unknown or
 * repeated keys, empty names, impossible durations, starts before the
 * project, waits on removed tasks, dependency loops, and a plan with no
 * stages left.
 */
export function validatePlanTailoring(
  definition: WorkflowTemplateDefinition,
  tailoring: PlanTailoring,
  projectStartDate: CalendarDate,
): Issue[] {
  const issues = keyIssues(definition, tailoring);
  if (issues.length > 0) return issues;
  const tailored = tailorDefinition(definition, tailoring);
  if (tailored.stages.length === 0) {
    return [{ path: 'removedStageKeys', message: 'Keep or add at least one stage.' }];
  }
  issues.push(
    ...additionIssues(tailored, tailoring),
    ...adjustmentIssues(tailored, tailoring, projectStartDate),
  );
  return issues.length > 0 ? issues : loopIssues(tailored);
}
