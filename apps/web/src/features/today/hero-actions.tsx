'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import { Button } from '@lintel/design-system/web';
import { Check, Hand, OctagonPause, Pause, Play, Send } from 'lucide-react';
import { useTask } from '@/features/tasks/use-task';
import { useTaskActions } from '@/features/tasks/use-task-actions';
import { WorkTimer } from '@/features/tasks/work-timer';
import { canStartFrom, useWorkTracking } from '@/features/tasks/work-tracking';

interface HeroActionsProps {
  readonly task: TaskSummary;
  readonly onBeforeChange: () => void;
  readonly onReportBlocker: () => void;
}

/**
 * The hero's buttons. Uses the task's detail for the live work session and
 * the finishing moves the server allows; until it loads, the summary decides.
 */
export function HeroActions({ task, onBeforeChange, onReportBlocker }: HeroActionsProps) {
  const detail = useTask(task.id).data;
  const actions = useTaskActions();
  const queueTracking = useWorkTracking();
  const tracking = detail?.workTrackingEnabled ?? queueTracking;
  const run = (action: () => void) => {
    onBeforeChange();
    action();
  };
  const sessionStartedAt = detail?.activeWorkSessionStartedAt ?? null;
  const finish = detail?.transitions.find(
    (option) =>
      option.allowed && (option.to === 'in_review' || option.to === 'done') && !option.requiresNote,
  );
  const canStart =
    task.status === 'ready' || task.status === 'changes_requested' || task.status === 'in_progress';
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
      ) : !tracking ? (
        // Without time tracking, starting is a plain status move.
        canStartFrom(task.status) && (
          <Button
            variant="blueprint"
            pending={actions.transition.isPending}
            leadingIcon={<Play aria-hidden />}
            onClick={() =>
              run(() =>
                actions.transition.mutate({
                  taskId: task.id,
                  to: 'in_progress',
                  note: null,
                  version,
                }),
              )
            }
          >
            Start task
          </Button>
        )
      ) : sessionStartedAt ? (
        <Button
          variant="blueprint"
          pending={actions.pauseWork.isPending}
          leadingIcon={<Pause aria-hidden />}
          onClick={() => run(() => actions.pauseWork.mutate(task.id))}
        >
          Pause
          <WorkTimer
            startedAt={sessionStartedAt}
            className="font-mono text-[0.8125rem] opacity-70"
          />
        </Button>
      ) : (
        canStart && (
          <Button
            variant="blueprint"
            pending={actions.startWork.isPending}
            leadingIcon={<Play aria-hidden />}
            onClick={() => run(() => actions.startWork.mutate(task.id))}
          >
            {task.status === 'in_progress' ? 'Resume work' : 'Start work'}
          </Button>
        )
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
