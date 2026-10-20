'use client';

import { Button, Checkbox, IconButton, Input } from '@lintel/design-system/web';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';

export interface ListItem {
  readonly text: string;
  readonly required: boolean;
}

interface ItemListEditorProps {
  readonly title: string;
  readonly hint: string;
  readonly items: readonly ListItem[];
  readonly onChange: (items: ListItem[]) => void;
  readonly itemLabel: string;
  readonly requiredLabel: string;
  readonly addLabel: string;
  readonly readOnly: boolean;
  readonly error?: string | undefined;
}

/** A short list of lines, each marked required or optional (checklists, deliverables). */
export function ItemListEditor({
  title,
  hint,
  items,
  onChange,
  itemLabel,
  requiredLabel,
  addLabel,
  readOnly,
  error,
}: ItemListEditorProps) {
  const titleId = useId();
  const update = (index: number, change: Partial<ListItem>) =>
    onChange(items.map((item, at) => (at === index ? { ...item, ...change } : item)));
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h4 id={titleId} className="type-label text-ink-muted">
            {title}
          </h4>
          <p className="type-body-sm text-ink-faint">{hint}</p>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => onChange([...items, { text: '', required: true }])}
          >
            {addLabel}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="type-body-sm text-overdue">
          {error}
        </p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity beyond their position
              key={index}
              className="flex flex-col gap-1 rounded-md border border-hairline bg-raised p-2 sm:flex-row sm:items-center sm:gap-3"
            >
              <Input
                aria-label={`${itemLabel} ${index + 1}`}
                value={item.text}
                disabled={readOnly}
                maxLength={200}
                onChange={(event) => update(index, { text: event.target.value })}
                className="h-10 flex-1"
              />
              <span className="flex items-center justify-between gap-2">
                <Checkbox
                  label={requiredLabel}
                  checked={item.required}
                  disabled={readOnly}
                  onCheckedChange={(required) => update(index, { required })}
                  className="py-0"
                />
                {!readOnly && (
                  <IconButton
                    label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                    size="sm"
                    onClick={() => onChange(items.filter((_, at) => at !== index))}
                  >
                    <Trash2 aria-hidden />
                  </IconButton>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
