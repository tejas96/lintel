'use client';

import type { Milestone, MilestoneRewardPlan, ProjectDetail } from '@lintel/api-contracts';
import {
  Button,
  Checkbox,
  Field,
  Input,
  SegmentedControl,
  Sheet,
  Textarea,
} from '@lintel/design-system/web';
import { DOCUMENT_FOLDER_LABELS, DOCUMENT_FOLDERS, PROJECT_ROLE_LABELS } from '@lintel/domain';
import { type FormEvent, useState } from 'react';
import { formatAmount } from '@/features/rewards/reward-presentation';
import { isApiError } from '@/lib/api/api-error';
import { formatCalendarDate } from '@/lib/format/dates';
import {
  checkRewardForm,
  type Folder,
  previewShares,
  type RewardFormProblems,
  rewardCandidates,
  toMinorUnits,
} from './milestone-reward-form';
import { useSaveMilestoneReward } from './use-milestone-actions';
import { WithdrawRewardSection } from './withdraw-reward-section';

const SCOPES = [
  { value: 'individual', label: 'One person' },
  { value: 'team', label: 'Shared by a group' },
] as const;

interface MilestoneRewardSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly project: ProjectDetail;
  readonly milestone: Milestone;
  readonly plan: MilestoneRewardPlan | null;
  readonly today: string;
}

/**
 * Attach a reward to an open milestone, for one person or shared equally by
 * a group, with the documents that must be on file. It is checked when the
 * milestone is completed, and a reviewer decides it.
 */
export function MilestoneRewardSheet(props: MilestoneRewardSheetProps) {
  const { project, milestone, today } = props;
  const live = props.plan?.state === 'planned' ? props.plan : null;
  const save = useSaveMilestoneReward(project.id);
  const candidates = rewardCandidates(project, (role) => PROJECT_ROLE_LABELS[role]);
  const [scope, setScope] = useState<'individual' | 'team'>(live?.scope ?? 'individual');
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    new Set(live?.recipients.map((share) => share.user.id) ?? []),
  );
  const [amount, setAmount] = useState(live ? String(live.amountMinor / 100) : '');
  const [folders, setFolders] = useState<ReadonlySet<Folder>>(
    new Set(live?.requiredDocumentFolders ?? []),
  );
  const [note, setNote] = useState(live?.note ?? '');
  const [problems, setProblems] = useState<RewardFormProblems>({});
  const amountMinor = toMinorUnits(amount);
  const people = candidates.filter((candidate) => chosen.has(candidate.user.id));

  const toggle = (userId: string) => {
    const next = new Set(scope === 'individual' ? [] : chosen);
    if (chosen.has(userId) && scope === 'team') next.delete(userId);
    else next.add(userId);
    setChosen(next);
    setProblems({ ...problems, recipients: undefined });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = checkRewardForm({ scope, people: people.length, amountMinor });
    setProblems(found);
    if (Object.keys(found).length > 0 || amountMinor === null) return;
    save.mutate(
      {
        milestone,
        plan: props.plan,
        scope,
        recipientUserIds: people.map((candidate) => candidate.user.id),
        amountMinor,
        requiredDocumentFolders: [...folders],
        note: note.trim() || null,
      },
      {
        onSuccess: () => props.onOpenChange(false),
        onError: (error) => {
          if (!isApiError(error)) return;
          const fields = error.fieldErrors();
          setProblems({
            recipients: fields.recipientUserIds,
            amount:
              fields.amountMinor ?? (Object.keys(fields).length === 0 ? error.message : undefined),
          });
        },
      },
    );
  };

  return (
    <Sheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      width="lg"
      title={live ? 'Change the milestone reward' : 'Attach a reward'}
      description={`“${milestone.name}”, due ${formatCalendarDate(milestone.dueDate, today)}`}
      footer={
        <>
          <Button variant="quiet" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="milestone-reward" variant="primary" pending={save.isPending}>
            {live ? 'Save changes' : 'Attach reward'}
          </Button>
        </>
      }
    >
      <form id="milestone-reward" onSubmit={submit} className="flex flex-col gap-6 p-5 sm:p-6">
        <p className="type-body-sm text-ink-muted">
          When the milestone is completed, the reward is checked: required deliverables submitted
          and approved, completed by {formatCalendarDate(milestone.dueDate, today)} (or a date moved
          by an approved scope change), and the documents you tick below on file. Waiting on a
          client, a supplier, a decision or a colleague does not count as late. A reviewer decides;
          nothing is paid or deducted automatically.
        </p>
        <SegmentedControl
          label="Who receives it"
          value={scope}
          onValueChange={(next) => {
            setScope(next);
            if (next === 'individual' && chosen.size > 1) setChosen(new Set());
          }}
          options={SCOPES}
          size="sm"
          className="self-start"
        />
        <fieldset className="flex flex-col gap-1">
          <legend className="type-label text-ink">
            {scope === 'individual' ? 'Person' : 'People sharing it'}
          </legend>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {candidates.map((candidate) => (
              <Checkbox
                key={candidate.user.id}
                checked={chosen.has(candidate.user.id)}
                onCheckedChange={() => toggle(candidate.user.id)}
                label={candidate.user.fullName}
                description={candidate.role}
              />
            ))}
          </div>
          {problems.recipients && (
            <p className="type-body-sm text-overdue">{problems.recipients}</p>
          )}
        </fieldset>
        <Field
          label="Amount (₹)"
          hint={scope === 'team' ? 'The total, split equally.' : undefined}
          error={problems.amount}
          className="max-w-xs"
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            leading={<span className="text-[0.9375rem]">₹</span>}
          />
        </Field>
        {scope === 'team' && people.length > 1 && amountMinor !== null && (
          <ul aria-label="Each share" className="flex flex-col gap-1 rounded-md bg-sunken/60 p-3">
            {previewShares(amountMinor, people).map(({ candidate, shareMinor }) => (
              <li key={candidate.user.id} className="flex justify-between gap-3 type-body-sm">
                <span className="text-ink-muted">{candidate.user.fullName}</span>
                <span className="font-mono text-ink tabular-nums">
                  {formatAmount(shareMinor, project.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <fieldset className="flex flex-col gap-1">
          <legend className="type-label text-ink">Documents that must be on file</legend>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {DOCUMENT_FOLDERS.map((folder) => (
              <Checkbox
                key={folder}
                checked={folders.has(folder)}
                onCheckedChange={(checked) => {
                  const next = new Set(folders);
                  if (checked) next.add(folder);
                  else next.delete(folder);
                  setFolders(next);
                }}
                label={DOCUMENT_FOLDER_LABELS[folder]}
              />
            ))}
          </div>
        </fieldset>
        <Field label="Note for them (optional)" hint="What the reward is for, in your words.">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
          />
        </Field>
        {live && (
          <WithdrawRewardSection
            project={project}
            milestone={milestone}
            plan={live}
            onDone={() => props.onOpenChange(false)}
          />
        )}
      </form>
    </Sheet>
  );
}
