import type { MilestoneRewardPlan, ProjectDetail, UserSummary } from '@lintel/api-contracts';
import { splitMilestoneReward } from '@lintel/domain';

export type Folder = MilestoneRewardPlan['requiredDocumentFolders'][number];

export interface RewardCandidate {
  readonly user: UserSummary;
  readonly role: string;
}

/** People who can receive a milestone reward: the project's members, manager and owner. */
export function rewardCandidates(
  project: ProjectDetail,
  roleLabel: (role: ProjectDetail['members'][number]['projectRole']) => string,
): RewardCandidate[] {
  const byId = new Map<string, RewardCandidate>();
  byId.set(project.manager.id, { user: project.manager, role: 'Project manager' });
  for (const member of project.members) {
    if (!byId.has(member.user.id)) {
      byId.set(member.user.id, { user: member.user, role: roleLabel(member.projectRole) });
    }
  }
  if (!byId.has(project.owner.id))
    byId.set(project.owner.id, { user: project.owner, role: 'Owner' });
  return [...byId.values()]
    .filter((candidate) => candidate.user.status === 'active')
    .sort((left, right) => left.user.fullName.localeCompare(right.user.fullName));
}

/** "3000" or "2,500.50" in rupees → minor units, or null when it isn't an amount. */
export function toMinorUnits(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/**
 * The split the server will make, for the preview: equal shares by name
 * order, the remainder one paisa each to the first people.
 */
export function previewShares(
  amountMinor: number | null,
  people: readonly RewardCandidate[],
): { candidate: RewardCandidate; shareMinor: number }[] {
  if (amountMinor === null || people.length === 0) return [];
  const shares = splitMilestoneReward(amountMinor, people.length);
  return people.map((candidate, index) => ({ candidate, shareMinor: shares[index] ?? 0 }));
}

export interface RewardFormProblems {
  recipients?: string | undefined;
  amount?: string | undefined;
}

export function checkRewardForm(input: {
  readonly scope: 'individual' | 'team';
  readonly people: number;
  readonly amountMinor: number | null;
}): RewardFormProblems {
  const problems: RewardFormProblems = {};
  if (input.scope === 'individual' && input.people !== 1)
    problems.recipients = 'Choose one person.';
  if (input.scope === 'team' && (input.people < 2 || input.people > 20)) {
    problems.recipients = 'Choose 2 to 20 people to share it.';
  }
  if (input.amountMinor === null) problems.amount = 'Enter an amount in rupees, like 5000.';
  return problems;
}
