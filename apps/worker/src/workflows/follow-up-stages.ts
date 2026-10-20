import { condition } from '@temporalio/workflow';
import type { FollowUpPlan, FollowUpSendResult } from '../activities';
import type { FollowUpWorkflowOutcome } from './workflow-contract';

export interface FollowUpRunner<TStage extends string> {
  readonly stages: readonly TStage[];
  plan(): Promise<FollowUpPlan>;
  send(stage: TStage): Promise<FollowUpSendResult>;
  /** True once a signal said the subject was decided or resolved. */
  isResolved(): boolean;
}

/**
 * Waits until the stage is due (or the subject resolves). The plan is reloaded
 * after every wait, so waits always come from the record's real times.
 */
async function waitForStage<TStage extends string>(
  runner: FollowUpRunner<TStage>,
  stage: TStage,
): Promise<'due' | 'resolved'> {
  for (;;) {
    if (runner.isResolved()) return 'resolved';
    const plan = await runner.plan();
    if (!plan.active) return 'resolved';
    const delayMs = plan.stages.find((candidate) => candidate.key === stage)?.delayMs ?? 0;
    if (delayMs <= 0) return 'due';
    await condition(() => runner.isResolved(), delayMs);
  }
}

/** Runs wait-then-notify stages in order and stops as soon as the subject is resolved. */
export async function runFollowUpStages<TStage extends string>(
  runner: FollowUpRunner<TStage>,
): Promise<FollowUpWorkflowOutcome> {
  for (const stage of runner.stages) {
    if ((await waitForStage(runner, stage)) === 'resolved') return 'resolved';
    if ((await runner.send(stage)) === 'resolved') return 'resolved';
  }
  return 'completed';
}
