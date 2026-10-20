'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import {
  Button,
  Checkbox,
  IconButton,
  Input,
  layoutSpring,
  ProgressRing,
} from '@lintel/design-system/web';
import { Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { DetailSection } from './detail-section';
import { useTaskDetailMutations } from './use-task-detail-mutations';

/** Checklist with ticks that draw themselves; required items say so. */
export function TaskChecklist({ task }: { readonly task: TaskDetail }) {
  const { toggleItem, addItem, removeItem } = useTaskDetailMutations(task.id);
  const [label, setLabel] = useState('');
  const items = [...task.checklistItems].sort((left, right) => left.position - right.position);
  const done = items.filter((item) => item.completedAt).length;
  const requiredLeft = items.filter((item) => item.isRequired && !item.completedAt).length;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    addItem.mutate({ label: trimmed, isRequired: false }, { onSuccess: () => setLabel('') });
  };

  if (items.length === 0 && !task.viewerCanEdit) return null;
  return (
    <DetailSection
      title="Checklist"
      meta={items.length > 0 ? `${done} of ${items.length} done` : undefined}
      action={
        items.length > 0 && (
          <ProgressRing
            value={done / items.length}
            label={`${done} of ${items.length} checklist items done`}
            size={28}
            thickness={3}
            toneClassName="text-accent"
          />
        )
      }
    >
      {requiredLeft > 0 && (
        <p className="type-body-sm text-ink-muted">
          {requiredLeft} required {requiredLeft === 1 ? 'item' : 'items'} left before this can be
          finished.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised px-3">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={layoutSpring}
              className="group flex items-center gap-2"
            >
              <Checkbox
                className="flex-1"
                checked={item.completedAt !== null}
                onCheckedChange={(completed) => toggleItem.mutate({ itemId: item.id, completed })}
                label={item.label}
                description={
                  item.isRequired
                    ? item.completedBy
                      ? `Required, ticked by ${item.completedBy.fullName}`
                      : 'Required'
                    : item.completedBy
                      ? `Ticked by ${item.completedBy.fullName}`
                      : undefined
                }
                strikeWhenChecked
              />
              {task.viewerCanEdit && (
                <IconButton
                  label={`Remove “${item.label}”`}
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  onClick={() => removeItem.mutate(item.id)}
                >
                  <X aria-hidden />
                </IconButton>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <li className="py-4 type-body-sm text-ink-faint">
            No checklist yet. Add the steps that prove this is done.
          </li>
        )}
      </ul>
      {task.viewerCanEdit && (
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Add a checklist item"
            aria-label="New checklist item"
            maxLength={200}
          />
          <Button
            type="submit"
            variant="secondary"
            pending={addItem.isPending}
            leadingIcon={<Plus aria-hidden />}
          >
            Add
          </Button>
        </form>
      )}
    </DetailSection>
  );
}
