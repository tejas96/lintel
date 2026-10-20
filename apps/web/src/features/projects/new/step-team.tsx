'use client';

import { DatePicker, Field, Input } from '@lintel/design-system/web';
import { PROJECT_ROLE_LABELS } from '@lintel/domain';
import { PersonCombobox } from '@/features/people/person-combobox';
import { usePublishedTemplate } from './use-templates';
import { rolesInTemplate, type WizardState } from './wizard-state';

interface StepTeamProps {
  readonly state: WizardState;
  readonly update: (patch: Partial<WizardState>) => void;
  readonly errors: Readonly<Record<string, string>>;
  readonly today: string;
}

/** When it starts, who runs it, and who does each kind of work in the template. */
export function StepTeam({ state, update, errors, today }: StepTeamProps) {
  const { version } = usePublishedTemplate(state.templateId);
  const roles = rolesInTemplate(version);
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Start date"
          hint="Template dates are planned forward from here, skipping holidays."
          error={errors.plannedStartDate}
          required
        >
          <DatePicker
            value={state.plannedStartDate}
            onValueChange={(plannedStartDate) => update({ plannedStartDate })}
            today={today}
          />
        </Field>
        <Field label="Project manager" error={errors.managerUserId} required>
          <PersonCombobox
            value={state.managerUserId}
            onValueChange={(managerUserId) => update({ managerUserId })}
          />
        </Field>
      </div>
      {roles.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="type-title-md text-ink">Who does the work</h3>
            <p className="type-body-sm text-ink-muted">
              Tasks in the template are assigned to these people. Leave a role empty to assign
              later.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {roles.map((role) => (
              <Field key={role} label={PROJECT_ROLE_LABELS[role]}>
                <PersonCombobox
                  value={state.roleAssignments[role] ?? null}
                  onValueChange={(userId) => {
                    const next = { ...state.roleAssignments };
                    if (userId) next[role] = userId;
                    else delete next[role];
                    update({ roleAssignments: next });
                  }}
                  clearable
                />
              </Field>
            ))}
          </div>
        </section>
      )}
      <Field
        label="Budget"
        hint="Optional, in rupees. Only people who can see project finances will see it."
        error={errors.budgetMinor}
        className="sm:max-w-xs"
      >
        <Input
          inputMode="decimal"
          value={state.budgetRupees}
          onChange={(event) => update({ budgetRupees: event.target.value.replace(/[^\d.,]/g, '') })}
          leading={<span className="text-[0.9375rem]">₹</span>}
          placeholder="0"
        />
      </Field>
    </div>
  );
}
