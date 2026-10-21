import type {
  BlockerReportRecord,
  CompletedMilestoneRecord,
  CompletedTaskRecord,
  RewardDecision,
  RewardEvaluationRecord,
  RewardEvaluationUpsert,
  RewardPolicyInput,
  RewardPolicyRecord,
  RewardStore,
} from '../rewards/reward.store';

type StoredEvaluation = RewardEvaluationUpsert & {
  id: string;
  version: number;
  decision: RewardDecision | null;
};

/** Test double for RewardStore that enforces the (policy, subject, period) uniqueness. */
export class InMemoryRewardStore implements RewardStore {
  readonly policies: RewardPolicyRecord[] = [];
  readonly evaluations: StoredEvaluation[] = [];
  readonly tasks: CompletedTaskRecord[] = [];
  readonly blockers: BlockerReportRecord[] = [];
  readonly milestones: CompletedMilestoneRecord[] = [];
  people: { userId: string; teamId: string | null }[] = [];
  private sequence = 0;

  async findPolicy(id: string) {
    return this.policies.find((policy) => policy.id === id) ?? null;
  }
  async createPolicy(input: RewardPolicyInput, currency: string) {
    this.sequence += 1;
    const policy = { ...input, id: `policy-${this.sequence}`, currency, version: 1 };
    this.policies.push(policy);
    return policy;
  }
  async updatePolicy(id: string, expectedVersion: number, input: RewardPolicyInput) {
    const index = this.policies.findIndex((policy) => policy.id === id);
    const current = this.policies[index];
    if (!current || current.version !== expectedVersion) return null;
    const updated = { ...current, ...input, version: current.version + 1 };
    this.policies[index] = updated;
    return updated;
  }
  async individualSubjects() {
    return this.people;
  }
  async teamSubjects() {
    const teams = [
      ...new Set(this.people.flatMap((person) => (person.teamId ? [person.teamId] : []))),
    ];
    return teams.map((teamId) => ({
      teamId,
      memberUserIds: this.people.filter((p) => p.teamId === teamId).map((p) => p.userId),
    }));
  }
  async completedTasks(userIds: readonly string[], from: Date, to: Date) {
    return this.tasks.filter(
      (task) =>
        task.completedAt >= from &&
        task.completedAt < to &&
        ((task.ownerUserId !== null && userIds.includes(task.ownerUserId)) ||
          task.collaboratorUserIds.some((id) => userIds.includes(id))),
    );
  }
  async blockerReports(userIds: readonly string[], from: Date, to: Date) {
    return this.blockers.filter(
      (report) =>
        userIds.includes(report.raisedByUserId) && report.raisedAt >= from && report.raisedAt < to,
    );
  }
  async completedMilestones(from: Date, to: Date) {
    return this.milestones.filter((m) => m.completedAt >= from && m.completedAt < to);
  }
  async upsertEvaluation(input: RewardEvaluationUpsert) {
    const existing = this.evaluations.find(
      (row) =>
        row.policyId === input.policyId &&
        row.subjectKey === input.subjectKey &&
        row.periodStart === input.periodStart,
    );
    if (!existing) {
      this.sequence += 1;
      this.evaluations.push({
        ...input,
        id: `evaluation-${this.sequence}`,
        version: 1,
        decision: null,
      });
      return 'created' as const;
    }
    if (existing.decision) return 'decided' as const;
    Object.assign(existing, input, { version: existing.version + 1 });
    return 'refreshed' as const;
  }
  async findEvaluation(id: string): Promise<RewardEvaluationRecord | null> {
    const row = this.evaluations.find((evaluation) => evaluation.id === id);
    if (!row) return null;
    return {
      id: row.id,
      policyId: row.policyId,
      policyName: this.policies.find((policy) => policy.id === row.policyId)?.name ?? '?',
      userId: row.userId,
      teamId: row.teamId,
      periodStart: row.periodStart,
      status: row.decision?.status ?? row.status,
      amountMinor: row.amountMinor,
      adjustedAmountMinor: row.decision?.adjustedAmountMinor ?? null,
      decidedByUserId: row.decision?.decidedByUserId ?? null,
      decisionNote: row.decision?.decisionNote ?? null,
      version: row.version,
    };
  }
  async decideEvaluation(id: string, expectedVersion: number, decision: RewardDecision) {
    const row = this.evaluations.find((evaluation) => evaluation.id === id);
    if (!row || row.version !== expectedVersion || row.decision) return false;
    Object.assign(row, { decision, version: row.version + 1 });
    return true;
  }
  async correctEvaluation(id: string, expectedVersion: number, decision: RewardDecision) {
    const row = this.evaluations.find((evaluation) => evaluation.id === id);
    if (!row || row.version !== expectedVersion) return false;
    if ((row.decision?.status ?? row.status) === 'pending_review') return false;
    Object.assign(row, { decision, version: row.version + 1 });
    return true;
  }
  async teamMemberIds(teamId: string) {
    return this.people.filter((person) => person.teamId === teamId).map((person) => person.userId);
  }
}
