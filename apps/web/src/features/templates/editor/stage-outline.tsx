'use client';

import { Button, cn, IconButton, StatusGlyph } from '@lintel/design-system/web';
import { pluralize } from '@lintel/shared';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { stageIssueCount, type TemplateIssue } from '../template-issues';
import type { WorkflowDefinition } from '../template-types';

interface StageOutlineProps {
  readonly definition: WorkflowDefinition;
  readonly selected: number;
  readonly issues: readonly TemplateIssue[];
  readonly readOnly: boolean;
  readonly onSelect: (index: number) => void;
  readonly onMove: (index: number, direction: -1 | 1) => void;
  readonly onAdd: () => void;
}

/** The stages in order, like a drawing index: pick one to edit, or move it. */
/** "Stage 2: Concept, 4 tasks, 1 problem to fix": the whole card as one name. */
function stageLabel(index: number, name: string, tasks: number, problems: number): string {
  const issues = problems > 0 ? `, ${pluralize(problems, 'problem')} to fix` : '';
  return `Stage ${index + 1}: ${name || 'Untitled stage'}, ${pluralize(tasks, 'task')}${issues}`;
}

export function StageOutline({
  definition,
  selected,
  issues,
  readOnly,
  onSelect,
  onMove,
  onAdd,
}: StageOutlineProps) {
  const count = definition.stages.length;
  return (
    <nav aria-label="Stages" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="type-title-md text-ink">Stages</h2>
        {!readOnly && (
          <Button size="sm" variant="quiet" leadingIcon={<Plus aria-hidden />} onClick={onAdd}>
            Add stage
          </Button>
        )}
      </div>
      <ol className="flex flex-col gap-1">
        {definition.stages.map((stage, index) => {
          const active = index === selected;
          const problems = stageIssueCount(issues, stage);
          return (
            <li key={stage.key} className="group relative">
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                aria-label={stageLabel(index, stage.name, stage.tasks.length, problems)}
                onClick={() => onSelect(index)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-hairline bg-raised shadow-e1'
                    : 'border-transparent hover:bg-sunken/60',
                  active && !readOnly && count > 1 && 'pr-16',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 font-display text-[1.0625rem] leading-5 tabular-nums',
                    active ? 'text-accent' : 'text-ink-faint',
                  )}
                >
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      'truncate type-body-sm',
                      active ? 'font-medium text-ink' : 'text-ink',
                    )}
                  >
                    {stage.name || 'Untitled stage'}
                  </span>
                  <span className="text-[0.75rem] text-ink-faint">
                    {stage.tasks.length} {stage.tasks.length === 1 ? 'task' : 'tasks'}
                    {stage.requiresOptions && stage.requiresOptions.length > 0 && ', optional'}
                  </span>
                  {problems > 0 && (
                    <span className="inline-flex items-center gap-1 text-[0.75rem] text-overdue">
                      <StatusGlyph name="overdue" className="size-3" />
                      {problems} {problems === 1 ? 'problem' : 'problems'} to fix
                    </span>
                  )}
                </span>
              </button>
              {!readOnly && active && count > 1 && (
                <span className="absolute top-1.5 right-1.5 flex gap-0.5 bg-raised">
                  <IconButton
                    label={`Move ${stage.name} earlier`}
                    size="sm"
                    className="size-7"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Move ${stage.name} later`}
                    size="sm"
                    className="size-7"
                    disabled={index === count - 1}
                    onClick={() => onMove(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </IconButton>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
