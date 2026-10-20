'use client';

import { Button, Checkbox, IconButton, Input } from '@lintel/design-system/web';
import { Diamond, Plus, Trash2 } from 'lucide-react';
import { addMilestone, removeMilestone, updateStage } from '../definition-edits';
import { fieldMessage, type TemplateIssue } from '../template-issues';
import type { TemplateStage, WorkflowDefinition } from '../template-types';

interface MilestonesEditorProps {
  readonly stage: TemplateStage;
  readonly stageIndex: number;
  readonly issues: readonly TemplateIssue[];
  readonly readOnly: boolean;
  readonly edit: (change: (definition: WorkflowDefinition) => WorkflowDefinition) => void;
}

/** The moments a stage is measured by; tasks can be linked to one. */
export function MilestonesEditor({
  stage,
  stageIndex,
  issues,
  readOnly,
  edit,
}: MilestonesEditorProps) {
  const rename = (index: number, name: string) =>
    edit((definition) =>
      updateStage(definition, stageIndex, (current) => ({
        ...current,
        milestones: current.milestones.map((milestone, at) =>
          at === index ? { ...milestone, name } : milestone,
        ),
      })),
    );
  const setApproval = (index: number, requiresClientApproval: boolean) =>
    edit((definition) =>
      updateStage(definition, stageIndex, (current) => ({
        ...current,
        milestones: current.milestones.map((milestone, at) =>
          at === index ? { ...milestone, requiresClientApproval } : milestone,
        ),
      })),
    );
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title-md text-ink">Milestones</h3>
        {!readOnly && (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => edit((definition) => addMilestone(definition, stageIndex))}
          >
            Add milestone
          </Button>
        )}
      </div>
      {stage.milestones.length === 0 && (
        <p className="type-body-sm text-ink-faint">No milestones in this stage.</p>
      )}
      <ul className="flex flex-col gap-2">
        {stage.milestones.map((milestone, index) => {
          const error = fieldMessage(
            issues,
            (target) => target.kind === 'milestone' && target.milestoneKey === milestone.key,
            'name',
          );
          return (
            <li
              key={milestone.key}
              className="flex flex-col gap-2 rounded-md border border-hairline bg-raised p-3 sm:flex-row sm:items-center"
            >
              <Diamond aria-hidden className="hidden size-4 shrink-0 text-ink-faint sm:block" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Input
                  aria-label="Milestone name"
                  aria-invalid={error ? true : undefined}
                  value={milestone.name}
                  disabled={readOnly}
                  onChange={(event) => rename(index, event.target.value)}
                  maxLength={120}
                  className="h-10"
                />
                {error && <p className="type-body-sm text-overdue">{error}</p>}
              </div>
              <Checkbox
                label="Client signs off"
                checked={milestone.requiresClientApproval}
                disabled={readOnly}
                onCheckedChange={(checked) => setApproval(index, checked)}
                className="shrink-0 py-0"
              />
              {!readOnly && (
                <IconButton
                  label={`Remove ${milestone.name}`}
                  size="sm"
                  onClick={() =>
                    edit((definition) => removeMilestone(definition, stageIndex, index))
                  }
                >
                  <Trash2 aria-hidden />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
