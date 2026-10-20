'use client';

import { Field, Input, SegmentedControl, Select, Textarea } from '@lintel/design-system/web';
import { PROJECT_TYPE_LABELS, PROJECT_TYPES, type ProjectCriticality } from '@lintel/domain';
import type { WizardState } from './wizard-state';

const CRITICALITY = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const satisfies readonly { value: ProjectCriticality; label: string }[];

interface StepProps {
  readonly state: WizardState;
  readonly update: (patch: Partial<WizardState>) => void;
  readonly errors: Readonly<Record<string, string>>;
}

export function StepBasics({ state, update, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Project name" error={errors.name} required className="sm:col-span-2">
          <Input
            value={state.name}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="For example: Saska Residence"
            maxLength={200}
          />
        </Field>
        <Field label="Client" error={errors.clientName} required>
          <Input
            value={state.clientName}
            onChange={(event) => update({ clientName: event.target.value })}
            placeholder="Person or company"
            maxLength={200}
          />
        </Field>
        <Field label="Project type" hint="Decides which workflow templates fit.">
          <Select
            value={state.projectType}
            onValueChange={(projectType) =>
              update({
                projectType,
                templateId: null,
                templateVersionId: null,
                templateOptions: [],
                roleAssignments: {},
              })
            }
            options={PROJECT_TYPES.map((type) => ({
              value: type,
              label: PROJECT_TYPE_LABELS[type],
            }))}
          />
        </Field>
        <Field label="Client phone" error={errors.clientPhone}>
          <Input
            type="tel"
            value={state.clientPhone}
            onChange={(event) => update({ clientPhone: event.target.value })}
            maxLength={30}
          />
        </Field>
        <Field label="Client email" error={errors.clientEmail}>
          <Input
            type="email"
            value={state.clientEmail}
            onChange={(event) => update({ clientEmail: event.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="Site address" error={errors.siteAddress} className="sm:col-span-2">
          <Input
            value={state.siteAddress}
            onChange={(event) => update({ siteAddress: event.target.value })}
            maxLength={500}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 type-label text-ink-muted">
          How critical is it to the studio?
        </legend>
        <SegmentedControl
          label="Criticality"
          value={state.criticality}
          onValueChange={(criticality) => update({ criticality })}
          options={CRITICALITY}
          className="self-start"
        />
      </fieldset>
      <Field
        label="Brief"
        hint="Optional. What the client wants, in a few lines."
        error={errors.description}
      >
        <Textarea
          value={state.description}
          onChange={(event) => update({ description: event.target.value })}
          maxLength={5000}
        />
      </Field>
    </div>
  );
}
