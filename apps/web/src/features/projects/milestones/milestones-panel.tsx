'use client';

import type { Milestone, MilestoneRewardPlan, ProjectDetail } from '@lintel/api-contracts';
import { Badge, Button, Card, CardHeader, cn, StatusGlyph } from '@lintel/design-system/web';
import { Award, Check } from 'lucide-react';
import { useState } from 'react';
import { formatAmount } from '@/features/rewards/reward-presentation';
import { useSession } from '@/features/session/session-provider';
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';
import { CompleteMilestoneDialog } from './complete-milestone-dialog';
import { MilestoneRewardSheet } from './milestone-reward-sheet';
import { useProjectMilestoneRewards } from './use-milestone-actions';

interface Opened {
  readonly kind: 'reward' | 'complete';
  readonly milestone: Milestone;
  /** Each opening starts the form fresh. */
  readonly key: number;
}

const PLAN_WORDS: Readonly<Record<MilestoneRewardPlan['state'], string>> = {
  planned: 'checked at completion',
  checked: 'checked, with the reviewer',
  withdrawn: 'withdrawn',
};

function RewardChip({ plan }: { readonly plan: MilestoneRewardPlan }) {
  const who =
    plan.recipients.length === 1
      ? (plan.recipients[0]?.user.fullName ?? '')
      : `shared by ${plan.recipients.length}`;
  return (
    <Badge className={cn(plan.state === 'withdrawn' && 'line-through opacity-70')}>
      <Award aria-hidden className="size-3" />
      {formatAmount(plan.amountMinor, plan.currency)} · {who} · {PLAN_WORDS[plan.state]}
    </Badge>
  );
}

function milestoneLine(milestone: Milestone, today: string): string {
  if (milestone.status === 'completed' && milestone.completedAt) {
    return `Completed ${formatRelativeInstant(milestone.completedAt)}`;
  }
  if (milestone.status === 'cancelled') return 'Cancelled';
  const due = `Due ${formatCalendarDate(milestone.dueDate, today)}`;
  if (milestone.openTaskCount === 0) return `${due} · all tasks closed`;
  return `${due} · ${milestone.openTaskCount} open ${milestone.openTaskCount === 1 ? 'task' : 'tasks'}`;
}

/**
 * Milestones with their sign-off and rewards. Project managers complete a
 * milestone once its tasks are closed; owners and administrators attach a
 * reward to an open milestone. Hidden from everyone else.
 */
export function MilestonesPanel({
  project,
  today,
}: {
  readonly project: ProjectDetail;
  readonly today: string;
}) {
  const { can } = useSession();
  const planner = can('rewards.manage_policies');
  const seesRewards = planner || can('rewards.decide') || can('rewards.view_all');
  const rewards = useProjectMilestoneRewards(project.id, seesRewards);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [visible, setVisible] = useState(false);
  const show = (kind: Opened['kind'], milestone: Milestone) => {
    setOpened({ kind, milestone, key: (opened?.key ?? 0) + 1 });
    setVisible(true);
  };
  if (!seesRewards && !project.viewerCanManage) return null;
  const planOf = (milestone: Milestone) =>
    rewards.data?.find((plan) => plan.milestoneId === milestone.id) ?? null;
  // Open milestones can be completed or rewarded; closed ones only matter when they carried a reward.
  const milestones = project.milestones
    .filter((milestone) => milestone.status === 'pending' || planOf(milestone) !== null)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  if (milestones.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title={seesRewards ? 'Sign-off and rewards' : 'Sign-off'}
        description={
          seesRewards
            ? 'Open milestones, and those that carried a reward. A reward is checked when its milestone is completed, then a reviewer decides.'
            : 'Complete a milestone once every task of it is closed.'
        }
      />
      <ul className="flex flex-col px-2 pb-3">
        {milestones.map((milestone) => {
          const plan = planOf(milestone);
          const pending = milestone.status === 'pending';
          return (
            <li
              key={milestone.id}
              className="flex flex-col gap-3 rounded-md px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <StatusGlyph
                  name={
                    milestone.status === 'completed'
                      ? 'done'
                      : milestone.status === 'cancelled'
                        ? 'cancelled'
                        : 'notStarted'
                  }
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    milestone.status === 'completed' ? 'text-on-track' : 'text-ink-faint',
                  )}
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="type-body-sm font-medium text-ink">{milestone.name}</p>
                  <p className="type-body-sm text-ink-muted">{milestoneLine(milestone, today)}</p>
                  {plan && <RewardChip plan={plan} />}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 pl-7 sm:pl-0">
                {planner && pending && (
                  <Button
                    size="sm"
                    variant="quiet"
                    leadingIcon={<Award aria-hidden />}
                    onClick={() => show('reward', milestone)}
                  >
                    {plan?.state === 'planned' ? 'Edit reward' : 'Add reward'}
                  </Button>
                )}
                {project.viewerCanManage && pending && milestone.openTaskCount === 0 && (
                  <Button
                    size="sm"
                    leadingIcon={<Check aria-hidden />}
                    onClick={() => show('complete', milestone)}
                  >
                    Complete
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {opened?.kind === 'reward' && (
        <MilestoneRewardSheet
          key={opened.key}
          open={visible}
          onOpenChange={setVisible}
          project={project}
          milestone={opened.milestone}
          plan={planOf(opened.milestone)}
          today={today}
        />
      )}
      {opened?.kind === 'complete' && (
        <CompleteMilestoneDialog
          key={opened.key}
          open={visible}
          onOpenChange={setVisible}
          projectId={project.id}
          milestone={opened.milestone}
          plan={planOf(opened.milestone)}
        />
      )}
    </Card>
  );
}
