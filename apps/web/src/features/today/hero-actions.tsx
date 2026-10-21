'use client';

import type { TaskDetail, TaskSummary } from '@lintel/api-contracts';
import { Button } from '@lintel/design-system/web';
import { Check, Hand, OctagonPause, Pause, Play, Send } from 'lucide-react';
import { useTask } from '@/features/tasks/use-task';
import { useTaskActions } from '@/features/tasks/use-task-actions';
import { WorkTimer } from '@/features/tasks/work-timer';
import { canStartFrom, startMove, useWorkTracking } from '@/features/tasks/work-tracking';

interface HeroActionsProps {
  readonly task: TaskSummary;
  readonly onBeforeChange: () => void;
  readonly onReportBlocker: () => void;
}

interface StartControlProps {
  readonly task: TaskSummary;
  readonly detail: TaskDetail | undefined;
  readonly run: (action: () => void) => void;
}

/**
 * Start, pause or resume. With time tracking a work session runs; without
 * it, starting is a plain status move and there is nothing to pause.
 */
function StartControl({ task, detail, run }: StartControlProps) {
  const actions = useTaskActions();
  const queueTracking = useWorkTracking();
  const tracking = detail?.workTrackingEnabled ?? queueTracking;
  const sessionStartedAt = detail?.activeWorkSessionStartedAt ?? null;
  // Once the detail has loaded, only offer a start the server would allow.
  const startRefused = detail !== undefined && startMove(task.status, detail.transitions) === null;
  if (!tracking) {
    if (!canStartFrom(task.status) || startRefused) return null;
    const version = detail?.version ?? task.version;
    return (
      <Button
        variant="blueprint"
        pending={actions.transition.isPending}
        leadingIcon={<Play aria-hidden />}
        onClick={() =>
          run(() =>
            actions.transition.mutate({ taskId: task.id, to: 'in_progress', note: null, version }),
          )
        }
      >
        Start task
      </Button>
    );
  }
  if (sessionStartedAt) {
    return (
      <Button
        variant="blueprint"
        pending={actions.pauseWork.isPending}
        leadingIcon={<Pause aria-hidden />}
        onClick={() => run(() => actions.pauseWork.mutate(task.id))}
      >
        Pause
        <WorkTimer startedAt={sessionStartedAt} className="font-mono text-[0.8125rem] opacity-70" />
      </Button>
    );
  }
  if (task.status !== 'in_progress' && (!canStartFrom(task.status) || startRefused)) return null;
  return (
    <Button
      variant="blueprint"
      pending={actions.startWork.isPending}
      leadingIcon={<Play aria-hidden />}
      onClick={() => run(() => actions.startWork.mutate(task.id))}
    >
      {task.status === 'in_progress' ? 'Resume work' : 'Start work'}
    </Button>
  );
}

/**
 * The hero's buttons. Uses the task's detail for the live work session and
 * the finishing moves the server allows; until it loads, the summary decides.
 */
export function HeroActions({ task, onBeforeChange, onReportBlocker }: HeroActionsProps) {
  const detail = useTask(task.id).data;
  const actions = useTaskActions();
  const run = (action: () => void) => {
    onBeforeChange();
    action();
  };
  const finish = detail?.transitions.find(
    (option) =>
      option.allowed && (option.to === 'in_review' || option.to === 'done') && !option.requiresNote,
  );
  const version = detail?.version ?? task.version;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {task.needsAcknowledgement ? (
        <Button
          variant="blueprint"
          pending={actions.acknowledge.isPending}
          leadingIcon={<Hand aria-hidden />}
          onClick={() => run(() => actions.acknowledge.mutate(task.id))}
        >
          Acknowledge
        </Button>
      ) : (
        <StartControl task={task} detail={detail} run={run} />
      )}
      {finish && (
        <Button
          variant="blueprintQuiet"
          pending={actions.transition.isPending}
          leadingIcon={finish.to === 'in_review' ? <Send aria-hidden /> : <Check aria-hidden />}
          onClick={() =>
            run(() =>
              actions.transition.mutate({ taskId: task.id, to: finish.to, note: null, version }),
            )
          }
        >
          {finish.label}
        </Button>
      )}
      {task.status !== 'blocked' && (
        <Button
          variant="blueprintQuiet"
          leadingIcon={<OctagonPause aria-hidden />}
          onClick={onReportBlocker}
        >
          Report a blocker
        </Button>
      )}
    </div>
  );
}
