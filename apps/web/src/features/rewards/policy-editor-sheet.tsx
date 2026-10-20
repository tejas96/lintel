'use client';

import type { RewardPolicy } from '@lintel/api-contracts';
import {
  Button,
  Field,
  Input,
  SegmentedControl,
  Sheet,
  Switch,
  Textarea,
} from '@lintel/design-system/web';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { CriteriaEditor } from './criteria-editor';
import { type CriterionDraft, draftOf, newDraft } from './criterion-definitions';
import { readPolicyForm } from './policy-form';
import { useSavePolicy } from './use-reward-policies';

interface PolicyEditorSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The policy to edit; null creates a new one. */
  readonly policy: RewardPolicy | null;
}

/** Create or change a reward policy: who it is for, how often, what counts, and how much. */
export function PolicyEditorSheet({ open, onOpenChange, policy }: PolicyEditorSheetProps) {
  const save = useSavePolicy();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const [name, setName] = useState(policy?.name ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [scope, setScope] = useState<RewardPolicy['scope']>(policy?.scope ?? 'individual');
  const [period, setPeriod] = useState<RewardPolicy['period']>(policy?.period ?? 'monthly');
  const [amount, setAmount] = useState(policy ? String(policy.amountMinor / 100) : '');
  const [isActive, setActive] = useState(policy?.isActive ?? true);
  const [drafts, setDrafts] = useState<CriterionDraft[]>(
    policy ? policy.criteria.map(draftOf) : [newDraft('on_time_delivery_rate')],
  );
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  /** A field's message goes as soon as the person changes that field. */
  const clear = (prefix: string) =>
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(prefix))),
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = readPolicyForm({ name, description, scope, period, amount, isActive, drafts });
    setErrors(result.errors);
    if (!result.body) return;
    save.mutate(
      { policy, body: result.body },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (staleness.catchStale(error)) return;
          if (isApiError(error)) setErrors(error.fieldErrors());
          fail(error, policy ? 'save the policy' : 'create the policy');
        },
      },
    );
  };
  const criterionErrors: Record<number, Record<string, string>> = {};
  for (const [field, message] of Object.entries(errors)) {
    const match = /^criteria\.(\d+)\.(\w+)$/.exec(field);
    if (!match?.[1] || !match[2]) continue;
    const index = Number(match[1]);
    criterionErrors[index] = { ...criterionErrors[index], [match[2]]: message };
  }

  return (
    <Sheet
      autoFocusField
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={policy ? 'Edit reward policy' : 'New reward policy'}
      description="Changes apply to the next evaluation. Rewards already decided stay as they are."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="reward-policy"
            variant="primary"
            pending={save.isPending}
            disabled={staleness.stale}
          >
            {policy ? 'Save policy' : 'Create policy'}
          </Button>
        </>
      }
    >
      <form id="reward-policy" onSubmit={submit} className="flex flex-col gap-6 p-5 sm:p-6">
        <StaleVersionNotice
          show={staleness.stale}
          message="Someone else changed this policy while you were editing. Close this, reopen the policy and make your change again."
          onRefresh={() => {
            staleness.clear();
            onOpenChange(false);
          }}
        />
        <Field label="Name" error={errors.name} required>
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clear('name');
            }}
            maxLength={200}
          />
        </Field>
        <Field
          label="Description"
          hint="Optional. Shown to the people it applies to."
          error={errors.description}
        >
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="type-label text-ink-muted">Who it is for</span>
            <SegmentedControl
              label="Who it is for"
              value={scope}
              onValueChange={setScope}
              options={[
                { value: 'individual', label: 'Each person' },
                { value: 'team', label: 'Each team' },
              ]}
              size="sm"
              className="self-start"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="type-label text-ink-muted">How often</span>
            <SegmentedControl
              label="How often"
              value={period}
              onValueChange={setPeriod}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
              ]}
              size="sm"
              className="self-start"
            />
          </div>
        </div>
        <Field
          label="Amount (₹)"
          hint="Paid separately from salary. Reviewers may adjust it with a reason."
          error={errors.amountMinor}
          required
          className="max-w-xs"
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              clear('amountMinor');
            }}
            leading={<span className="text-[0.9375rem]">₹</span>}
          />
        </Field>
        <CriteriaEditor
          drafts={drafts}
          onChange={(next) => {
            setDrafts(next);
            clear('criteria');
          }}
          errors={criterionErrors}
          listError={errors.criteria}
        />
        <Switch
          label="Evaluate this policy"
          description="Paused policies are kept, but no new evaluations are made."
          checked={isActive}
          onCheckedChange={setActive}
        />
      </form>
    </Sheet>
  );
}
