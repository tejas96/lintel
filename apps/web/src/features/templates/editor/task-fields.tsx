'use client';

import {
  Field,
  Input,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
} from '@lintel/design-system/web';
import { withOptional } from '../definition-edits';
import {
  PRIORITY_OPTIONS,
  ROLE_OPTIONS,
  type TemplateTask,
  type WorkflowDefinition,
} from '../template-types';
import { IntegerInput } from './integer-input';

interface TaskFieldsProps {
  readonly definition: WorkflowDefinition;
  readonly task: TemplateTask;
  readonly change: (edit: (task: TemplateTask) => TemplateTask) => void;
  readonly errorFor: (field: string) => string | undefined;
  readonly readOnly: boolean;
}

const NO_MILESTONE = '__none__';

/** What the task is, who does it, how long it takes and how it is checked. */
export function TaskFields({ definition, task, change, errorFor, readOnly }: TaskFieldsProps) {
  const milestones = definition.stages.flatMap((stage) =>
    stage.milestones.map((milestone) => ({
      value: milestone.key,
      label: milestone.name,
      description: stage.name,
    })),
  );
  return (
    <div className="flex flex-col gap-5">
      <Field label="Task" error={errorFor('title')} required>
        <Input
          value={task.title}
          disabled={readOnly}
          maxLength={200}
          onChange={(event) => change((current) => ({ ...current, title: event.target.value }))}
        />
      </Field>
      <Field
        label="What to do"
        hint="Optional. Copied into each project’s task."
        error={errorFor('description')}
      >
        <Textarea
          value={task.description ?? ''}
          disabled={readOnly}
          rows={3}
          maxLength={2000}
          onChange={(event) =>
            change((current) =>
              withOptional(current, 'description', event.target.value || undefined),
            )
          }
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Done by"
          hint="Filled with the person in this role on each project."
          error={errorFor('responsibleRole')}
        >
          <Select
            value={task.responsibleRole}
            disabled={readOnly}
            options={ROLE_OPTIONS}
            onValueChange={(responsibleRole) =>
              change((current) => ({ ...current, responsibleRole }))
            }
          />
        </Field>
        <Field
          label="Linked milestone"
          hint="The milestone this task moves forward."
          error={errorFor('milestoneKey')}
        >
          <Select
            value={task.milestoneKey ?? NO_MILESTONE}
            disabled={readOnly}
            options={[{ value: NO_MILESTONE, label: 'No milestone' }, ...milestones]}
            onValueChange={(value) =>
              change((current) =>
                withOptional(current, 'milestoneKey', value === NO_MILESTONE ? undefined : value),
              )
            }
          />
        </Field>
        <Field label="Takes (working days)" error={errorFor('durationDays')} required>
          <IntegerInput
            value={task.durationDays}
            disabled={readOnly}
            onValueChange={(value) =>
              value !== undefined && change((current) => ({ ...current, durationDays: value }))
            }
          />
        </Field>
        <Field
          label="Effort (hours)"
          hint="Optional. Used for capacity; 2 hours is assumed when empty."
          error={errorFor('estimateMinutes')}
        >
          <IntegerInput
            optional
            value={
              task.estimateMinutes === undefined ? undefined : Math.round(task.estimateMinutes / 60)
            }
            disabled={readOnly}
            onValueChange={(hours) =>
              change((current) =>
                withOptional(
                  current,
                  'estimateMinutes',
                  hours === undefined ? undefined : hours * 60,
                ),
              )
            }
          />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="type-label text-ink-muted">Priority</span>
        <SegmentedControl
          label="Priority"
          value={task.priority}
          options={PRIORITY_OPTIONS}
          size="sm"
          className="self-start"
          onValueChange={(priority) => !readOnly && change((current) => ({ ...current, priority }))}
        />
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4">
        <Switch
          label="Needs a review before it is done"
          description="Someone else checks the work and approves it or asks for changes."
          checked={task.requiresReview}
          disabled={readOnly}
          onCheckedChange={(requiresReview) =>
            change((current) =>
              withOptional(
                { ...current, requiresReview },
                'reviewerRole',
                requiresReview ? (current.reviewerRole ?? 'manager') : undefined,
              ),
            )
          }
        />
        {task.requiresReview && (
          <Field label="Reviewed by" error={errorFor('reviewerRole')}>
            <Select
              value={task.reviewerRole}
              disabled={readOnly}
              options={ROLE_OPTIONS}
              onValueChange={(reviewerRole) => change((current) => ({ ...current, reviewerRole }))}
            />
          </Field>
        )}
      </div>
      <Field
        label="Tell the project manager after (days overdue)"
        hint="Optional. Leave empty to use the studio’s default of 1 day."
        error={errorFor('escalateAfterOverdueDays')}
        className="max-w-sm"
      >
        <IntegerInput
          optional
          value={task.escalateAfterOverdueDays}
          disabled={readOnly}
          onValueChange={(days) =>
            change((current) => withOptional(current, 'escalateAfterOverdueDays', days))
          }
        />
      </Field>
    </div>
  );
}
