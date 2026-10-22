'use client';

import { Checkbox, cn, ErrorState, SkeletonText } from '@lintel/design-system/web';
import { pluralize } from '@lintel/shared';
import { Check } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { useEffect } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { EMPTY_PLAN_DRAFT } from './plan-draft';
import { usePublishedTemplate, useTemplates } from './use-templates';
import type { WizardState } from './wizard-state';

const CARD =
  'relative flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors duration-(--duration-fast)';

/** Pick a workflow template (or none) and its optional parts. */
export function StepWorkflow({
  state,
  update,
}: {
  readonly state: WizardState;
  readonly update: (patch: Partial<WizardState>) => void;
}) {
  const templates = useTemplates(state.projectType);
  const chosen = usePublishedTemplate(state.templateId);
  const suggested = templates.data?.find((template) => template.publishedVersion !== null);
  useEffect(() => {
    if (state.templateId || state.skipTemplate || !suggested?.publishedVersion) return;
    update({ templateId: suggested.id, templateVersionId: suggested.publishedVersion.id });
  }, [state.templateId, state.skipTemplate, suggested, update]);
  if (templates.isPending) return <SkeletonText lines={5} />;
  if (templates.isError)
    return (
      <ErrorState
        size="section"
        {...describeError(templates.error, { resource: 'collection' })}
        onRetry={() => templates.refetch()}
      />
    );
  const published = templates.data.filter((template) => template.publishedVersion !== null);
  const value = state.templateId ?? 'none';

  return (
    <div className="flex flex-col gap-6">
      <RadioGroup.Root
        aria-label="Workflow template"
        value={value}
        onValueChange={(next) => {
          const template = published.find((candidate) => candidate.id === next);
          update({
            skipTemplate: !template,
            templateId: template?.id ?? null,
            templateVersionId: template?.publishedVersion?.id ?? null,
            templateOptions: [],
            roleAssignments: {},
            plan: EMPTY_PLAN_DRAFT,
          });
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        {published.map((template) => (
          <RadioGroup.Item
            key={template.id}
            value={template.id}
            className={cn(
              CARD,
              value === template.id
                ? 'border-accent bg-accent-soft/50'
                : 'border-hairline bg-raised hover:border-rule',
            )}
          >
            <span className="type-title-md text-ink">{template.name}</span>
            {template.description && (
              <span className="type-body-sm text-ink-muted">{template.description}</span>
            )}
            <span className="type-body-sm text-ink-faint">
              {template.publishedVersion &&
                `${pluralize(template.publishedVersion.stageCount, 'stage')}, ${pluralize(template.publishedVersion.taskCount, 'task')}, version ${template.publishedVersion.versionNumber}`}
            </span>
            {value === template.id && (
              <Check aria-hidden className="absolute top-4 right-4 size-4 text-accent" />
            )}
          </RadioGroup.Item>
        ))}
        <RadioGroup.Item
          value="none"
          className={cn(
            CARD,
            value === 'none'
              ? 'border-accent bg-accent-soft/50'
              : 'border-dashed border-rule bg-transparent hover:border-ink-faint',
          )}
        >
          <span className="type-title-md text-ink">Start without a template</span>
          <span className="type-body-sm text-ink-muted">
            An empty project. Add stages and tasks later.
          </span>
          {value === 'none' && (
            <Check aria-hidden className="absolute top-4 right-4 size-4 text-accent" />
          )}
        </RadioGroup.Item>
      </RadioGroup.Root>
      {published.length === 0 && (
        <p className="type-body-sm text-ink-faint">
          No published templates for this project type yet.
        </p>
      )}
      {state.templateId && chosen.isPending && <SkeletonText lines={3} />}
      {chosen.version && (
        <div className="grid gap-6 lg:grid-cols-2">
          {chosen.version.definition.options.length > 0 && (
            <fieldset className="flex flex-col">
              <legend className="mb-1 type-title-md text-ink">Optional parts</legend>
              {chosen.version.definition.options.map((option) => (
                <Checkbox
                  key={option.key}
                  label={option.label}
                  checked={state.templateOptions.includes(option.key)}
                  onCheckedChange={(checked) =>
                    update({
                      templateOptions: checked
                        ? [...state.templateOptions, option.key]
                        : state.templateOptions.filter((key) => key !== option.key),
                      plan: EMPTY_PLAN_DRAFT,
                    })
                  }
                />
              ))}
            </fieldset>
          )}
          <div className="flex flex-col gap-2">
            <h3 className="type-title-md text-ink">Stages it creates</h3>
            <ol className="flex flex-col gap-1.5">
              {chosen.version.definition.stages.map((stage, index) => {
                const optional = stage.requiresOptions && stage.requiresOptions.length > 0;
                const included =
                  !optional ||
                  stage.requiresOptions?.some((key) => state.templateOptions.includes(key));
                return (
                  <li
                    key={stage.key}
                    className={cn(
                      'flex items-baseline gap-3 type-body-sm',
                      included ? 'text-ink' : 'text-ink-faint line-through',
                    )}
                  >
                    <span className="w-5 text-right font-mono text-[0.75rem] text-ink-faint">
                      {index + 1}
                    </span>
                    {stage.name}
                    <span className="text-ink-faint">{pluralize(stage.tasks.length, 'task')}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
