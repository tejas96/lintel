'use client';

import { Button, Sheet } from '@lintel/design-system/web';
import { CircleAlert, Trash2 } from 'lucide-react';
import { removeTask, updateTask } from '../definition-edits';
import { type TemplateIssue, taskIssues } from '../template-issues';
import { allTasks, type TemplateTask, type WorkflowDefinition } from '../template-types';
import { DependencyPicker } from './dependency-picker';
import { ItemListEditor } from './item-list-editor';
import { TaskFields } from './task-fields';

interface TaskSheetProps {
  /** The task shown; kept while the sheet slides away. */
  readonly taskKey: string | null;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly definition: WorkflowDefinition;
  readonly issues: readonly TemplateIssue[];
  readonly readOnly: boolean;
  readonly edit: (change: (definition: WorkflowDefinition) => WorkflowDefinition) => void;
}

/** Every detail of one template task, edited in place; changes join the unsaved draft. */
export function TaskSheet({
  taskKey,
  visible,
  onClose,
  definition,
  issues,
  readOnly,
  edit,
}: TaskSheetProps) {
  const place = allTasks(definition).find((entry) => entry.task.key === taskKey);
  const open = place ? { stageIndex: place.stageIndex, taskIndex: place.taskIndex } : null;
  const stage = place?.stage;
  const task = place?.task;
  const problems = task ? taskIssues(issues, task.key) : [];
  const errorFor = (field: string) =>
    problems.find((problem) => problem.target.field === field)?.message;
  // Workflow rules (loops, missing references) come back about the task as a whole.
  const general = problems.filter(
    (problem) =>
      problem.target.field === null ||
      ![
        'title',
        'description',
        'responsibleRole',
        'durationDays',
        'estimateMinutes',
        'milestoneKey',
        'reviewerRole',
        'escalateAfterOverdueDays',
        'dependsOn',
        'checklist',
        'deliverables',
        'priority',
      ].includes(problem.target.field),
  );
  const change = (patch: (current: TemplateTask) => TemplateTask) => {
    if (!open) return;
    edit((current) => updateTask(current, open.stageIndex, open.taskIndex, patch));
  };

  return (
    <Sheet
      autoFocusField
      open={visible && task !== undefined}
      onOpenChange={(next) => !next && onClose()}
      width="lg"
      title={task?.title || 'Untitled task'}
      description={
        stage ? `In ${stage.name}. Changes are part of the draft until you save.` : undefined
      }
      footer={
        <>
          {!readOnly && open && (
            <Button
              variant="quiet"
              leadingIcon={<Trash2 aria-hidden />}
              className="mr-auto text-overdue"
              onClick={() => {
                edit((current) => removeTask(current, open.stageIndex, open.taskIndex));
                onClose();
              }}
            >
              Remove task
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {task && (
        <div className="flex flex-col gap-8 p-5 sm:p-6">
          {general.length > 0 && (
            <ul
              role="alert"
              className="flex flex-col gap-1.5 rounded-md border border-overdue-solid/30 bg-overdue-tint/50 p-3"
            >
              {general.map((problem) => (
                <li key={problem.message} className="flex items-start gap-2 type-body-sm text-ink">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-overdue" />
                  {problem.message}
                </li>
              ))}
            </ul>
          )}
          <TaskFields
            definition={definition}
            task={task}
            change={change}
            errorFor={errorFor}
            readOnly={readOnly}
          />
          <DependencyPicker
            definition={definition}
            task={task}
            readOnly={readOnly}
            error={errorFor('dependsOn')}
            onChange={(dependsOn) => change((current) => ({ ...current, dependsOn }))}
          />
          <ItemListEditor
            title="Checklist"
            hint="Steps to tick off. Required ones must be done before the task can finish."
            itemLabel="Checklist item"
            requiredLabel="Required"
            addLabel="Add a step"
            readOnly={readOnly}
            error={errorFor('checklist')}
            items={task.checklist.map((item) => ({ text: item.label, required: item.required }))}
            onChange={(items) =>
              change((current) => ({
                ...current,
                checklist: items.map((item) => ({ label: item.text, required: item.required })),
              }))
            }
          />
          <ItemListEditor
            title="Deliverables"
            hint="Files the task produces. Each is versioned and reviewed in the project."
            itemLabel="Deliverable"
            requiredLabel="Required"
            addLabel="Add a deliverable"
            readOnly={readOnly}
            error={errorFor('deliverables')}
            items={task.deliverables.map((item) => ({ text: item.name, required: item.required }))}
            onChange={(items) =>
              change((current) => ({
                ...current,
                deliverables: items.map((item) => ({ name: item.text, required: item.required })),
              }))
            }
          />
        </div>
      )}
    </Sheet>
  );
}
