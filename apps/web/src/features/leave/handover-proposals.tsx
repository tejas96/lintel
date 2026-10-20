'use client';

import type { LeaveConflict } from '@lintel/api-contracts';
import { Field, Input, StatusGlyph } from '@lintel/design-system/web';
import { AnimatePresence, motion } from 'motion/react';
import { PersonCombobox } from '@/features/people/person-combobox';
import type { ApiError } from '@/lib/api/api-error';
import type { HandoverProposal } from './decision/use-leave-decision';

export interface HandoverDraft {
  readonly toUserId: string | null;
  readonly note: string;
}

export type HandoverDrafts = Readonly<Record<string, HandoverDraft>>;

/** One entry per affected task (a task can conflict in more than one way). */
export function affectedTasks(conflicts: readonly LeaveConflict[]): LeaveConflict[] {
  const seen = new Map<string, LeaveConflict>();
  for (const conflict of conflicts) {
    const known = seen.get(conflict.taskId);
    if (!known || (known.severity === 'warning' && conflict.severity === 'critical')) {
      seen.set(conflict.taskId, conflict);
    }
  }
  return [...seen.values()];
}

/** The proposals to send: only tasks with a colleague chosen, in a stable order. */
export function handoversFrom(drafts: HandoverDrafts): HandoverProposal[] {
  return Object.entries(drafts)
    .filter(([, draft]) => draft.toUserId !== null)
    .map(([taskId, draft]) => ({
      taskId,
      toUserId: draft.toUserId,
      note: draft.note.trim() || null,
    }));
}

/** Server messages for `handovers.N.*`, keyed by the task they belong to. */
export function handoverErrorsFrom(
  error: ApiError,
  sent: readonly HandoverProposal[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(error.fieldErrors())) {
    const index = /^handovers\.(\d+)\./.exec(field)?.[1];
    const proposal = index === undefined ? undefined : sent[Number(index)];
    if (proposal) errors[proposal.taskId] = message;
  }
  return errors;
}

interface HandoverProposalsProps {
  readonly conflicts: readonly LeaveConflict[];
  readonly drafts: HandoverDrafts;
  readonly onChange: (drafts: HandoverDrafts) => void;
  readonly requesterId: string;
  readonly errors?: Readonly<Record<string, string>>;
}

/** For each affected task, propose a colleague to cover it and say what they need to know. */
export function HandoverProposals({
  conflicts,
  drafts,
  onChange,
  requesterId,
  errors = {},
}: HandoverProposalsProps) {
  const tasks = affectedTasks(conflicts);
  if (tasks.length === 0) return null;
  const update = (taskId: string, change: Partial<HandoverDraft>) => {
    const current = drafts[taskId] ?? { toUserId: null, note: '' };
    onChange({ ...drafts, [taskId]: { ...current, ...change } });
  };
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="type-title-md text-ink">Who covers your work</h3>
        <p className="type-body-sm text-ink-muted">
          Optional. Each colleague is asked to accept; a project manager makes the change.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised">
        {tasks.map((task) => {
          const draft = drafts[task.taskId] ?? { toUserId: null, note: '' };
          return (
            <li key={task.taskId} className="flex flex-col gap-3 p-4">
              <p className="flex items-start gap-2 type-body-sm">
                <StatusGlyph
                  name={task.severity === 'critical' ? 'overdue' : 'atRisk'}
                  className={
                    task.severity === 'critical'
                      ? 'mt-0.5 size-3.5 shrink-0 text-overdue'
                      : 'mt-0.5 size-3.5 shrink-0 text-at-risk'
                  }
                />
                <span className="min-w-0">
                  <span className="font-medium text-ink">{task.title}</span>
                  <span className="text-ink-faint">
                    {' '}
                    in {task.projectName}
                    {task.severity === 'critical' ? ', critical' : ''}
                  </span>
                </span>
              </p>
              <Field label="Covered by" error={errors[task.taskId]}>
                <PersonCombobox
                  value={draft.toUserId}
                  onValueChange={(toUserId) => update(task.taskId, { toUserId })}
                  excludeIds={[requesterId]}
                  placeholder="Choose a colleague"
                  clearable
                />
              </Field>
              <AnimatePresence initial={false}>
                {draft.toUserId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="-mx-1 overflow-hidden px-1 pb-1"
                  >
                    <Field label="What they need to know" hint="Optional.">
                      <Input
                        value={draft.note}
                        onChange={(event) => update(task.taskId, { note: event.target.value })}
                        maxLength={1000}
                      />
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
