'use client';

import { Field, IconButton, Input, listItemEnter, Select } from '@lintel/design-system/web';
import type { RewardCriterionType } from '@lintel/domain';
import { Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { CRITERIA, CRITERION_TYPES, type CriterionDraft, newDraft } from './criterion-definitions';

interface CriteriaEditorProps {
  readonly drafts: readonly CriterionDraft[];
  readonly onChange: (drafts: CriterionDraft[]) => void;
  /** Messages per criterion index and field key. */
  readonly errors: Readonly<Record<number, Readonly<Record<string, string>>>>;
  readonly listError?: string | undefined;
}

/** Each criterion with its thresholds in plain labels; every one must be met. */
export function CriteriaEditor({ drafts, onChange, errors, listError }: CriteriaEditorProps) {
  const used = new Set(drafts.map((draft) => draft.type));
  const available = CRITERION_TYPES.filter((type) => !used.has(type));
  const update = (index: number, key: string, value: string) =>
    onChange(
      drafts.map((draft, position) =>
        position === index ? { ...draft, values: { ...draft.values, [key]: value } } : draft,
      ),
    );
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 flex flex-col gap-0.5">
        <span className="type-title-md text-ink">What has to be true</span>
        <span className="type-body-sm text-ink-muted">
          Every criterion must be met in the period. Each needs a minimum amount of work, so a quiet
          month never qualifies by accident.
        </span>
      </legend>
      {listError && <p className="type-body-sm text-overdue">{listError}</p>}
      <ul className="flex flex-col gap-2">
        {drafts.map((draft, index) => {
          const definition = CRITERIA[draft.type];
          return (
            <motion.li
              key={draft.type}
              {...listItemEnter(0)}
              className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="type-body font-medium text-ink">{definition.label}</p>
                  <p className="type-body-sm text-ink-muted">{definition.explanation}</p>
                </div>
                <IconButton
                  label={`Remove ${definition.label}`}
                  size="sm"
                  onClick={() => onChange(drafts.filter((_, position) => position !== index))}
                >
                  <Trash2 aria-hidden />
                </IconButton>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {definition.fields.map((field) => (
                  <Field key={field.key} label={field.label} error={errors[index]?.[field.key]}>
                    <Input
                      inputMode="numeric"
                      value={draft.values[field.key] ?? ''}
                      onChange={(event) => update(index, field.key, event.target.value)}
                      {...(field.kind === 'rate'
                        ? { trailing: <span className="pr-1">%</span> }
                        : {})}
                    />
                  </Field>
                ))}
              </div>
            </motion.li>
          );
        })}
      </ul>
      {available.length > 0 && drafts.length < 10 && (
        <Select<RewardCriterionType>
          // A fresh picker after each addition, so it always reads "Add a criterion…".
          key={drafts.length}
          label="Add a criterion"
          value={undefined}
          placeholder="Add a criterion…"
          onValueChange={(type) => onChange([...drafts, newDraft(type)])}
          options={available.map((type) => ({
            value: type,
            label: CRITERIA[type].label,
            description: CRITERIA[type].explanation,
          }))}
          className="sm:w-80"
        />
      )}
    </fieldset>
  );
}
