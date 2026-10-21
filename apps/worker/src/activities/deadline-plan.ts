import type { EscalationAudience, EscalationStep, NotificationKind } from '@lintel/domain';
import { delayUntil } from './working-time';

/** One step of a task's deadline timeline, as handed to the workflow (JSON-safe). */
export interface DeadlinePlanStep {
  /** Stable within one due date, e.g. "task_overdue.task_owner". */
  readonly key: string;
  readonly audience: EscalationAudience;
  readonly kind: NotificationKind;
  readonly label: string;
  readonly at: string;
  /** How long the workflow should wait before sending; 0 when already due. */
  readonly delayMs: number;
  /**
   * Already due, but a later step for the same audience is also due (for
   * example a task assigned after its deadline): sending it would be stale.
   */
  readonly superseded: boolean;
}

export interface DeadlinePlan {
  readonly open: boolean;
  readonly dueDate: string | null;
  readonly steps: readonly DeadlinePlanStep[];
}

export type DeadlineStepRef = Pick<DeadlinePlanStep, 'key' | 'audience' | 'kind'>;

export function deadlineStepKey(step: Pick<EscalationStep, 'audience' | 'kind'>): string {
  return `${step.kind}.${step.audience}`;
}

/** The late-start step names its planned start, so a new start date makes a new step. */
export function lateStartStepKey(plannedStartDate: string): string {
  return `task_late_start.task_owner@${plannedStartDate}`;
}

/** The planned start a late-start step was planned for (null for any other step). */
export function plannedStartOfStep(key: string): string | null {
  return key.startsWith('task_late_start.') ? (key.split('@')[1] ?? null) : null;
}

/** Converts the domain timeline into workflow steps relative to `now`. */
export function toDeadlinePlanSteps(
  steps: readonly EscalationStep[],
  now: Date,
  plannedStartDate: string | null = null,
): DeadlinePlanStep[] {
  const ordered = [...steps].sort((left, right) => left.at.getTime() - right.at.getTime());
  const latestDueIndex = new Map<EscalationAudience, number>();
  ordered.forEach((step, index) => {
    if (step.at.getTime() <= now.getTime()) latestDueIndex.set(step.audience, index);
  });
  return ordered.map((step, index) => {
    const due = step.at.getTime() <= now.getTime();
    return {
      key:
        step.kind === 'task_late_start' && plannedStartDate
          ? lateStartStepKey(plannedStartDate)
          : deadlineStepKey(step),
      audience: step.audience,
      kind: step.kind,
      label: step.label,
      at: step.at.toISOString(),
      delayMs: delayUntil(step.at, now),
      superseded: due && latestDueIndex.get(step.audience) !== index,
    };
  });
}
