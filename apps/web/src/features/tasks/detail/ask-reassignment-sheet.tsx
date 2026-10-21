'use client';

import { Button, Field, Sheet, Textarea } from '@lintel/design-system/web';
import { useState } from 'react';
import { PersonCombobox } from '@/features/people/person-combobox';
import { useReassignmentMutations } from './use-reassignments';

/** The owner or a collaborator asks the project manager to give the task to someone else. */
export function AskReassignmentSheet({
  task,
  open,
  onOpenChange,
}: {
  readonly task: { readonly id: string; readonly title: string; readonly ownerId: string | null };
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { ask } = useReassignmentMutations(task.id);
  const [reason, setReason] = useState('');
  const [suggested, setSuggested] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = () => {
    setReason('');
    setSuggested(null);
    setError(null);
  };
  const submit = () => {
    if (reason.trim().length < 3) {
      setError('Say why the task should move, so the project manager can decide.');
      return;
    }
    setError(null);
    ask.mutate(
      { reason: reason.trim(), suggestedUserId: suggested },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      autoFocusField
      title="Ask to hand this task over"
      description={`The project manager decides who takes “${task.title}”. You keep it until they do.`}
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" pending={ask.isPending} onClick={submit}>
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <Field label="Why should it move?" error={error} required>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="For example: I am on site at another project all week and the drawings are due on Friday."
          />
        </Field>
        <Field
          label="Who could take it?"
          hint="Optional. The project manager can choose someone else."
        >
          <PersonCombobox
            value={suggested}
            onValueChange={setSuggested}
            clearable
            placeholder="Suggest a person"
            excludeIds={task.ownerId ? [task.ownerId] : []}
          />
        </Field>
      </div>
    </Sheet>
  );
}
