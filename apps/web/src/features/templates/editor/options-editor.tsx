'use client';

import { Button, Checkbox, IconButton, Input } from '@lintel/design-system/web';
import { Plus, Trash2 } from 'lucide-react';
import { addOption, removeOption } from '../definition-edits';
import type { TemplateOption, WorkflowDefinition } from '../template-types';

interface OptionsEditorProps {
  readonly definition: WorkflowDefinition;
  readonly readOnly: boolean;
  readonly edit: (change: (definition: WorkflowDefinition) => WorkflowDefinition) => void;
}

/**
 * Yes-or-no questions asked when a project starts ("Does the studio also
 * execute the work?"). Stages can be limited to projects that answer yes.
 */
export function OptionsEditor({ definition, readOnly, edit }: OptionsEditorProps) {
  const update = (key: string, change: Partial<TemplateOption>) =>
    edit((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.key === key ? { ...option, ...change } : option,
      ),
    }));
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="type-title-md text-ink">Project options</h2>
        {!readOnly && (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => edit(addOption)}
          >
            Add option
          </Button>
        )}
      </div>
      <p className="px-1 type-body-sm text-ink-faint">
        Questions asked when a project starts. A stage can depend on the answer.
      </p>
      <ul className="flex flex-col gap-2">
        {definition.options.map((option) => (
          <li
            key={option.key}
            className="flex flex-col gap-1 rounded-md border border-hairline bg-raised p-3"
          >
            <div className="flex items-center gap-1">
              <Input
                aria-label="Question"
                value={option.label}
                disabled={readOnly}
                maxLength={200}
                onChange={(event) => update(option.key, { label: event.target.value })}
                className="h-10"
              />
              {!readOnly && (
                <IconButton
                  label={`Remove ${option.label}`}
                  size="sm"
                  onClick={() => edit((current) => removeOption(current, option.key))}
                >
                  <Trash2 aria-hidden />
                </IconButton>
              )}
            </div>
            <Checkbox
              label="Ticked for new projects"
              checked={option.enabledByDefault}
              disabled={readOnly}
              onCheckedChange={(enabledByDefault) => update(option.key, { enabledByDefault })}
              className="py-1"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
