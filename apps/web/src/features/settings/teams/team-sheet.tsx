'use client';

import type { Team } from '@lintel/api-contracts';
import { Button, Field, Input, Sheet, Textarea, useToast } from '@lintel/design-system/web';
import { normaliseTeamDefinition, TEAM_LIMITS, type TeamDefinition } from '@lintel/domain';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { useFieldErrors } from '@/features/common/use-field-errors';
import { PersonCombobox } from '@/features/people/person-combobox';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { type TeamChanges, useTeamMutations } from './use-teams';

/** What the sheet is doing: adding a team or editing one. */
export type TeamSheetMode =
  | { readonly kind: 'add' }
  | { readonly kind: 'edit'; readonly team: Team };

interface TeamFormValues {
  readonly name: string;
  readonly description: string;
  readonly leadUserId: string | null;
}

function definitionOf(values: TeamFormValues): TeamDefinition {
  return normaliseTeamDefinition(values);
}

/** Only what changed, so a save never overwrites someone else's edit by accident. */
function changesOf(team: Team, values: TeamFormValues): TeamChanges {
  const next = definitionOf(values);
  const before: TeamDefinition = {
    name: team.name,
    description: team.description,
    leadUserId: team.lead?.id ?? null,
  };
  const keys = Object.keys(next) as (keyof TeamDefinition)[];
  return Object.fromEntries(
    keys.filter((key) => next[key] !== before[key]).map((key) => [key, next[key]]),
  );
}

/** Quick checks before sending; the server applies the same rules. */
function checkTeam(values: TeamFormValues): Record<string, string> {
  const name = values.name.trim();
  return name.length < TEAM_LIMITS.nameMinLength ? { name: 'Give the team a name.' } : {};
}

interface TeamSheetProps {
  readonly mode: TeamSheetMode | null;
  readonly onClose: () => void;
  readonly onRefresh: () => void;
}

export function TeamSheet({ mode, onClose, onRefresh }: TeamSheetProps) {
  return (
    <Sheet
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      autoFocusField
      title={mode?.kind === 'edit' ? `Edit ${mode.team.name}` : 'Add a team'}
      description="Teams group people for filters, capacity and reports. A lead is optional."
    >
      {mode && (
        <TeamForm
          key={mode.kind === 'edit' ? `${mode.team.id}:${mode.team.version}` : 'add'}
          mode={mode}
          onDone={onClose}
          onRefresh={onRefresh}
        />
      )}
    </Sheet>
  );
}

function TeamForm({
  mode,
  onDone,
  onRefresh,
}: {
  readonly mode: TeamSheetMode;
  readonly onDone: () => void;
  readonly onRefresh: () => void;
}) {
  const toast = useToast();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const { create, update } = useTeamMutations();
  const [values, setValues] = useState<TeamFormValues>(() =>
    mode.kind === 'edit'
      ? {
          name: mode.team.name,
          description: mode.team.description ?? '',
          leadUserId: mode.team.lead?.id ?? null,
        }
      : { name: '', description: '', leadUserId: null },
  );
  const fields = useFieldErrors(checkTeam);
  const changes = mode.kind === 'edit' ? changesOf(mode.team, values) : null;
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof TeamFormValues>(key: K, value: TeamFormValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    fields.recheck(next);
  };
  const onError = (error: unknown) => {
    if (staleness.catchStale(error)) return;
    if (isApiError(error)) fields.showServerErrors(error.fieldErrors());
    fail(error, mode.kind === 'edit' ? 'save the team' : 'add the team');
  };
  const onSaved = (saved: Team) => {
    toast({
      tone: 'success',
      title: mode.kind === 'edit' ? 'Team saved' : 'Team added',
      description: saved.name,
    });
    onDone();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!fields.validate(values)) return;
    if (mode.kind === 'add') {
      create.mutate(definitionOf(values), { onSuccess: onSaved, onError });
    } else if (changes && Object.keys(changes).length > 0) {
      update.mutate({ team: mode.team, changes }, { onSuccess: onSaved, onError });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-7 p-5 sm:p-6" noValidate>
      <StaleVersionNotice
        show={staleness.stale}
        message="Someone else changed this team while you were editing. Refresh to load their version, then make your change again."
        onRefresh={() => {
          staleness.clear();
          onRefresh();
        }}
      />
      <div className="flex flex-col gap-4">
        <Field label="Name" error={fields.errors.name} required>
          <Input
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={TEAM_LIMITS.nameMaxLength}
            placeholder="For example: Design, Site, Procurement"
          />
        </Field>
        <Field
          label="Description"
          hint="Optional. What the team looks after."
          error={fields.errors.description}
        >
          <Textarea
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={TEAM_LIMITS.descriptionMaxLength}
            rows={2}
          />
        </Field>
        <Field
          label="Team lead"
          hint="Optional. Anyone active in the studio; they need not be on the team."
          error={fields.errors.leadUserId}
        >
          <PersonCombobox
            value={values.leadUserId}
            onValueChange={(leadUserId) => set('leadUserId', leadUserId)}
            clearable
            placeholder="Search people"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-hairline pt-5">
        <Button variant="quiet" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          disabled={staleness.stale || (changes !== null && Object.keys(changes).length === 0)}
        >
          {mode.kind === 'edit' ? 'Save changes' : 'Add team'}
        </Button>
      </div>
    </form>
  );
}
