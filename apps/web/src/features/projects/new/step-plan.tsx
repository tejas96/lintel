'use client';

import { EmptyState, Skeleton, SkeletonGroup } from '@lintel/design-system/web';
import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { isApiError } from '@/lib/api/api-error';
import type { PlanDraft } from './plan-draft';
import { PlanEditor } from './plan-editor';
import { buildPlanOutline } from './plan-outline';
import { PlanPreviewChart } from './plan-preview-chart';
import { PlanSummary } from './plan-summary';
import { usePlanPreview } from './use-plan-preview';
import { usePublishedTemplate } from './use-templates';
import type { WizardState } from './wizard-state';

/** "Visit the marble yard: Choose a stage that stays in the plan." from the server's field paths. */
function issueText(draft: PlanDraft, field: string | undefined, message: string): string {
  const match = /^tailoring\.(adjustments|addedTasks|addedStages)\.(\d+)/.exec(field ?? '');
  if (!match) return message;
  const index = Number(match[2]);
  const name =
    match[1] === 'adjustments'
      ? Object.keys(draft.adjustments)[index]
      : match[1] === 'addedTasks'
        ? draft.addedTasks[index]?.title
        : draft.addedStages[index]?.name;
  return name ? `${name}: ${message}` : message;
}

/**
 * Tailor the template before the project starts: leave out or add stages and
 * tasks, change start dates and lengths, choose a person per task — with the
 * server's plan builder dating the result live, end date included.
 */
export function StepPlan({
  state,
  update,
  today,
}: {
  readonly state: WizardState;
  readonly update: (patch: Partial<WizardState>) => void;
  readonly today: string;
}) {
  const { version } = usePublishedTemplate(state.templateId);
  const { preview, template, updating } = usePlanPreview(state);
  const outline = useMemo(
    () =>
      version
        ? buildPlanOutline(version.definition, state.templateOptions, state.plan, preview.data)
        : [],
    [version, state.templateOptions, state.plan, preview.data],
  );
  if (!state.templateVersionId) {
    return (
      <EmptyState
        drawing="plan"
        title="No template, nothing to tailor"
        description="This project starts with one open stage. Add tasks once it is created."
      />
    );
  }
  if (!version || (preview.isPending && !preview.data)) {
    return (
      <SkeletonGroup label="Dating the plan" className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </SkeletonGroup>
    );
  }
  const issues = isApiError(preview.error) ? preview.error.details : [];
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl type-body text-ink-muted">
        This is the plan the template makes for this project. Leave out what the client does not
        need, add what is missing, and set dates and people. Every change is dated again at once.
      </p>
      <PlanSummary
        preview={preview.data}
        template={template.data}
        updating={updating}
        today={today}
      />
      {issues.length > 0 && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-overdue-solid/40 bg-overdue-tint p-4"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-overdue" />
          <ul className="flex flex-col gap-1 type-body-sm text-ink">
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>
                {issueText(state.plan, issue.field, issue.message)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <PlanEditor
          outline={outline}
          draft={state.plan}
          onChange={(plan) => update({ plan })}
          today={today}
        />
        {preview.data && (
          <div className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-6">
            <h3 className="type-title-md text-ink">Timeline</h3>
            <PlanPreviewChart preview={preview.data} today={today} />
          </div>
        )}
      </div>
    </div>
  );
}
