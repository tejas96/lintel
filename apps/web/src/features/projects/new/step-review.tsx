'use client';

import { Avatar } from '@lintel/design-system/web';
import { PROJECT_ROLE_LABELS, PROJECT_ROLES, PROJECT_TYPE_LABELS } from '@lintel/domain';
import type { ReactNode } from 'react';
import { usePeopleOptions } from '@/features/people/use-people-options';
import { formatLongDate } from '@/lib/format/dates';
import { describeDraft } from './plan-draft';
import { usePlanPreview } from './use-plan-preview';
import { usePublishedTemplate } from './use-templates';
import { PLAN_STEP, type WizardState } from './wizard-state';

function Row({
  label,
  children,
  onEdit,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly onEdit: () => void;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr_auto] items-start gap-4 py-3 sm:grid-cols-[11rem_1fr_auto]">
      <dt className="type-body-sm text-ink-faint">{label}</dt>
      <dd className="min-w-0 type-body text-ink">{children}</dd>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-9 rounded-sm type-body-sm text-accent underline-offset-4 hover:underline"
      >
        Change
      </button>
    </div>
  );
}

/** Everything that will be created, with a way back to each part. */
export function StepReview({
  state,
  goTo,
}: {
  readonly state: WizardState;
  readonly goTo: (step: number) => void;
}) {
  const { people } = usePeopleOptions();
  const template = usePublishedTemplate(state.templateId);
  const { preview } = usePlanPreview(state);
  const person = (id: string | null | undefined) => people.find((candidate) => candidate.id === id);
  const manager = person(state.managerUserId);
  const assignments = PROJECT_ROLES.flatMap((role) => {
    const userId = state.roleAssignments[role];
    return userId ? [{ role, userId }] : [];
  });
  return (
    <dl className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised px-5">
      <Row label="Project" onEdit={() => goTo(0)}>
        <span className="font-medium">{state.name || 'Untitled'}</span>
        <span className="block type-body-sm text-ink-muted">
          {state.clientName}, {PROJECT_TYPE_LABELS[state.projectType]}, {state.criticality}{' '}
          criticality
        </span>
      </Row>
      <Row label="Workflow" onEdit={() => goTo(1)}>
        {template.data ? (
          <>
            {template.data.name}
            {template.version && (
              <span className="block type-body-sm text-ink-muted">
                Version {template.version.versionNumber},{' '}
                {template.version.definition.stages.length} stages
              </span>
            )}
          </>
        ) : (
          'No template'
        )}
      </Row>
      {state.templateVersionId && (
        <Row label="Plan" onEdit={() => goTo(PLAN_STEP)}>
          {preview.data ? (
            <>
              {preview.data.tasks.length} tasks, ends {formatLongDate(preview.data.plannedEndDate)}
              <span className="block type-body-sm text-ink-muted">
                {describeDraft(state.plan) ?? 'As the template plans it.'}
              </span>
            </>
          ) : (
            <span className="text-ink-muted">Dating the plan…</span>
          )}
        </Row>
      )}
      <Row label="Starts" onEdit={() => goTo(2)}>
        {state.plannedStartDate ? (
          formatLongDate(state.plannedStartDate)
        ) : (
          <span className="text-overdue">Choose a start date</span>
        )}
      </Row>
      <Row label="Manager" onEdit={() => goTo(2)}>
        {manager ? (
          <span className="flex items-center gap-2">
            <Avatar name={manager.fullName} hue={manager.avatarHue} size="xs" decorative />
            {manager.fullName}
          </span>
        ) : (
          <span className="text-overdue">Choose a project manager</span>
        )}
      </Row>
      {assignments.length > 0 && (
        <Row label="Team" onEdit={() => goTo(2)}>
          <ul className="flex flex-col gap-1">
            {assignments.map(({ role, userId }) => (
              <li key={role} className="type-body-sm">
                <span className="text-ink-muted">{PROJECT_ROLE_LABELS[role]}:</span>{' '}
                {person(userId)?.fullName ?? 'Unknown person'}
              </li>
            ))}
          </ul>
        </Row>
      )}
      {state.budgetRupees && (
        <Row label="Budget" onEdit={() => goTo(2)}>
          ₹{state.budgetRupees}
        </Row>
      )}
    </dl>
  );
}
