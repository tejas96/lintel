import {
  condition,
  continueAsNew,
  defineSignal,
  proxyActivities,
  setHandler,
  workflowInfo,
} from '@temporalio/workflow';
import type { DeadlinePlanStep, WorkerActivities } from '../activities';
import { DATABASE_ACTIVITY } from './activity-options';
import {
  type DeadlineCarryOver,
  type DeadlineWorkflowOutcome,
  type ScheduleChangedSignal,
  SIGNALS,
} from './workflow-contract';

const { loadDeadlinePlan, sendDeadlineStep } = proxyActivities<WorkerActivities>(DATABASE_ACTIVITY);

export const scheduleChangedSignal = defineSignal<[ScheduleChangedSignal?]>(
  SIGNALS.scheduleChanged,
);
export const taskClosedSignal = defineSignal(SIGNALS.taskClosed);

/** Plan reloads per run before continuing as new (keeps history small after many reschedules). */
export const MAX_RELOADS_PER_RUN = 50;

const EMPTY_CARRY_OVER: DeadlineCarryOver = { dueDate: null, sentStepKeys: [] };

function nextStep(steps: readonly DeadlinePlanStep[], handled: ReadonlySet<string>) {
  return steps.find((step) => !step.superseded && !handled.has(step.key));
}

interface DeadlineSignals {
  scheduleChanged: boolean;
  closed: boolean;
}

interface DeadlineProgress {
  dueDate: string | null;
  handled: Set<string>;
  reloads: number;
}

/** One pass: load the plan, then either wait for the next step or send it. */
async function advance(
  taskId: string,
  progress: DeadlineProgress,
  signals: DeadlineSignals,
): Promise<DeadlineWorkflowOutcome | 'continue'> {
  signals.scheduleChanged = false;
  const plan = await loadDeadlinePlan(taskId);
  if (!plan.open) return 'task_closed';
  if (plan.dueDate === null) return 'no_due_date';
  if (plan.dueDate !== progress.dueDate) {
    progress.dueDate = plan.dueDate;
    progress.handled = new Set();
  }
  const step = nextStep(plan.steps, progress.handled);
  if (!step) return 'all_steps_sent';
  if (step.delayMs > 0) {
    const interrupted = await condition(
      () => signals.scheduleChanged || signals.closed,
      step.delayMs,
    );
    if (interrupted) progress.reloads += 1;
    // Reload after waking: a long outage may have made this step stale (superseded).
    return 'continue';
  }
  const result = await sendDeadlineStep(taskId, plan.dueDate, step);
  if (result === 'task_closed') return 'task_closed';
  if (result === 'due_date_changed') progress.reloads += 1;
  else progress.handled.add(step.key);
  return 'continue';
}

/**
 * Reminds and escalates a task deadline: sleeps until the next step of the
 * plan, re-checks and notifies, and reloads the plan when the schedule
 * changes. Ends when the task closes, has no due date, or every step is sent.
 */
export async function taskDeadlineWorkflow(
  taskId: string,
  carried: DeadlineCarryOver = EMPTY_CARRY_OVER,
): Promise<DeadlineWorkflowOutcome> {
  const signals: DeadlineSignals = { scheduleChanged: false, closed: false };
  setHandler(scheduleChangedSignal, () => {
    signals.scheduleChanged = true;
  });
  setHandler(taskClosedSignal, () => {
    signals.closed = true;
  });
  const progress: DeadlineProgress = {
    dueDate: carried.dueDate,
    handled: new Set(carried.sentStepKeys),
    reloads: 0,
  };
  while (!signals.closed) {
    if (progress.reloads >= MAX_RELOADS_PER_RUN || workflowInfo().continueAsNewSuggested) {
      return continueAsNew<typeof taskDeadlineWorkflow>(taskId, {
        dueDate: progress.dueDate,
        sentStepKeys: [...progress.handled],
      });
    }
    const outcome = await advance(taskId, progress, signals);
    if (outcome !== 'continue') return outcome;
  }
  return 'task_closed';
}
