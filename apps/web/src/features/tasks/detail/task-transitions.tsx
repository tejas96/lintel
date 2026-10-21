'use client';

import type { TaskDetail, TransitionOption } from '@lintel/api-contracts';
import { Button, Dialog, Field, Textarea } from '@lintel/design-system/web';
import { Hand, Info, OctagonPause, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import { useTaskActions } from '../use-task-actions';
import { WorkTimer } from '../work-timer';
import { startMove } from '../work-tracking';

const FORWARD = new Set(['in_review', 'done']);

interface TaskTransitionsProps {
  readonly task: TaskDetail;
  readonly onReportBlocker: () => void;
}

/**
 * The status changes the server says this person may make, as buttons.
 * Moves that are not allowed yet are listed with the server's reasons, so
 * nothing is a mystery and nothing is a dead control.
 */
export function TaskTransitions({ task, onReportBlocker }: TaskTransitionsProps) {
  const actions = useTaskActions();
  const [noteFor, setNoteFor] = useState<TransitionOption | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  // With time tracking, "Start work" starts a session and moves the task in one
  // step, so the plain status button for that move is not shown as well.
  const startsWork =
    task.workTrackingEnabled && startMove(task.status, task.transitions) !== null;
  const workable = task.workTrackingEnabled && (task.status === 'in_progress' || startsWork);
  const allowed = task.transitions.filter(
    (option) =>
      option.allowed && option.to !== 'blocked' && !(startsWork && option.to === 'in_progress'),
  );
  const canBlock = task.transitions.some((option) => option.allowed && option.to === 'blocked');
  const refused = task.transitions.filter((option) => !option.allowed && option.reasons.length > 0);

  const move = (option: TransitionOption, withNote: string | null) =>
    actions.transition.mutate(
      { taskId: task.id, to: option.to, note: withNote, version: task.version },
      { onSuccess: () => setNoteFor(null) },
    );

  return (
    <div className="flex flex-col gap-3">
      {task.needsAcknowledgement && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/25 bg-accent-soft/60 p-3 pl-4">
          <p className="type-body-sm text-ink">
            This was assigned to you. Let your manager know you’ve seen it.
          </p>
          <Button
            size="sm"
            variant="primary"
            leadingIcon={<Hand aria-hidden />}
            pending={actions.acknowledge.isPending}
            onClick={() => actions.acknowledge.mutate(task.id)}
          >
            Acknowledge
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {task.workTrackingEnabled && task.activeWorkSessionStartedAt ? (
          <Button
            variant="secondary"
            leadingIcon={<Pause aria-hidden />}
            pending={actions.pauseWork.isPending}
            onClick={() => actions.pauseWork.mutate(task.id)}
          >
            Pause
            <WorkTimer
              startedAt={task.activeWorkSessionStartedAt}
              className="font-mono text-[0.8125rem] text-ink-faint"
            />
          </Button>
        ) : (
          workable && (
            <Button
              variant="secondary"
              leadingIcon={<Play aria-hidden />}
              pending={actions.startWork.isPending}
              onClick={() => actions.startWork.mutate(task.id)}
            >
              {task.status === 'in_progress' ? 'Resume work' : 'Start work'}
            </Button>
          )
        )}
        {allowed.map((option) => (
          <Button
            key={option.to}
            variant={
              FORWARD.has(option.to) ? 'primary' : option.to === 'cancelled' ? 'danger' : 'quiet'
            }
            pending={actions.transition.isPending && actions.transition.variables?.to === option.to}
            onClick={() => (option.requiresNote ? setNoteFor(option) : move(option, null))}
          >
            {option.label}
          </Button>
        ))}
        {canBlock && (
          <Button
            variant="quiet"
            leadingIcon={<OctagonPause aria-hidden />}
            onClick={onReportBlocker}
          >
            Report a blocker
          </Button>
        )}
      </div>
      {refused.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-md bg-sunken/70 p-3">
          {refused.map((option) => (
            <li key={option.to} className="flex items-start gap-2 type-body-sm text-ink-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
              <span>
                <span className="font-medium text-ink">{option.label}</span> isn’t available yet:{' '}
                {option.reasons.join(' ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={noteFor !== null}
        onOpenChange={(open) => {
          if (!open) setNoteFor(null);
        }}
        title={noteFor?.label ?? ''}
        description="Add a short note. It is kept with the task’s history."
        footer={
          <>
            <Button variant="quiet" onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              pending={actions.transition.isPending}
              onClick={() => {
                if (!noteFor) return;
                if (note.trim().length < 3) {
                  setNoteError('Write at least a few words.');
                  return;
                }
                setNoteError(null);
                move(noteFor, note.trim());
              }}
            >
              {noteFor?.label ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <Field label="Note" error={noteError} required>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
          />
        </Field>
      </Dialog>
    </div>
  );
}
