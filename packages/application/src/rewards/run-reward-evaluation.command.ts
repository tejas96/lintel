import {
  buildRewardMetrics,
  DEFAULT_WORKING_CALENDAR,
  evaluateRewardEligibility,
  type WorkingCalendar,
} from '@lintel/domain';
import {
  addDays,
  type CalendarDate,
  type Clock,
  calendarDateInTimeZone,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  toCalendarDate,
  ValidationFailedError,
  zonedTimeToInstant,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type {
  BlockerReportRecord,
  CompletedMilestoneRecord,
  CompletedTaskRecord,
  RewardPolicyRecord,
} from './reward.store';
import {
  blockerReportsFor,
  type FactContext,
  type InstantWindow,
  metricsEvidence,
  milestonesDeliveredOnTime,
  onTimeRateOf,
  taskOutcomesFor,
} from './reward-facts';
import { previousRewardPeriod, type RewardPeriodRange, rewardPeriodFor } from './reward-period';

export type RewardStores = Pick<ApplicationStores, 'rewards' | 'settings' | 'records'>;

interface RewardSubject {
  readonly key: string;
  readonly userId: string | null;
  readonly teamId: string | null;
  readonly members: ReadonlySet<string>;
}

interface PeriodFacts {
  readonly tasks: readonly CompletedTaskRecord[];
  readonly blockers: readonly BlockerReportRecord[];
  readonly milestones: readonly CompletedMilestoneRecord[];
  readonly current: InstantWindow;
  readonly previous: InstantWindow;
  readonly timeZone: string;
}

export interface RewardRunResult {
  /** Evaluations created or refreshed. Decided ones are never touched. */
  readonly evaluated: number;
  readonly eligible: number;
}

/**
 * Evaluates every subject of a policy for one month or quarter. Safe to
 * repeat: the unique (policy, subject, period) row is refreshed while
 * undecided and left alone once decided, so no reward is ever duplicated.
 */
export class RunRewardEvaluationCommand {
  constructor(
    private readonly uow: UnitOfWork<RewardStores>,
    private readonly clock: Clock,
  ) {}

  async execute(
    context: RequestContext,
    policyId: string,
    periodStart: string,
  ): Promise<RewardRunResult> {
    const capabilities = context.actor.capabilities;
    if (!capabilities.has('rewards.manage_policies') && !capabilities.has('rewards.decide')) {
      throw new ForbiddenError();
    }
    return this.uow.transaction(async (stores) => {
      const policy = await stores.rewards.findPolicy(policyId);
      if (!policy) throw new NotFoundError('Reward policy');
      if (!policy.isActive) throw new PreconditionFailedError('This reward policy is not active.');
      const { timeZone } = await stores.settings.organization();
      const period = rewardPeriodFor(toCalendarDate(periodStart), policy.period);
      if (period.start > calendarDateInTimeZone(this.clock.now(), timeZone)) {
        throw new ValidationFailedError('This period has not started yet.', [
          { field: 'periodStart', message: 'Choose a current or past period.' },
        ]);
      }
      const { evaluated, eligible } = await this.evaluateSubjects(stores, policy, period, timeZone);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'rewards.evaluation_run',
        entityType: 'reward_policy',
        entityId: policy.id,
        after: { periodStart: period.start, periodEnd: period.end, evaluated, eligible },
        requestId: context.requestId,
      });
      return { evaluated, eligible };
    });
  }

  /** Upserts one evaluation per subject; decided ones are skipped and not counted. */
  private async evaluateSubjects(
    stores: RewardStores,
    policy: RewardPolicyRecord,
    period: RewardPeriodRange,
    timeZone: string,
  ): Promise<RewardRunResult> {
    const subjects = await this.subjects(stores, policy);
    const userIds = [...new Set(subjects.flatMap((subject) => [...subject.members]))];
    const facts = await this.periodFacts(stores, userIds, period, policy, timeZone);
    const calendars = await stores.settings.calendarsForUsers(userIds);
    let evaluated = 0;
    let eligible = 0;
    for (const subject of subjects) {
      const calendar: WorkingCalendar =
        (subject.userId ? calendars.get(subject.userId) : undefined) ?? DEFAULT_WORKING_CALENDAR;
      const result = this.evaluate(policy, subject, facts, { calendar, timeZone });
      const outcome = await stores.rewards.upsertEvaluation({
        policyId: policy.id,
        subjectKey: subject.key,
        userId: subject.userId,
        teamId: subject.teamId,
        periodStart: period.start,
        periodEnd: period.end,
        status: result.eligible ? 'pending_review' : 'ineligible',
        summary: result.summary,
        evidence: result.evidence,
        amountMinor: policy.amountMinor,
      });
      if (outcome === 'decided') continue;
      evaluated += 1;
      if (result.eligible) eligible += 1;
    }
    return { evaluated, eligible };
  }

  private async subjects(
    stores: RewardStores,
    policy: RewardPolicyRecord,
  ): Promise<RewardSubject[]> {
    if (policy.scope === 'individual') {
      const people = await stores.rewards.individualSubjects();
      return people.map((person) => ({
        key: `user:${person.userId}`,
        userId: person.userId,
        teamId: null,
        members: new Set([person.userId]),
      }));
    }
    const teams = await stores.rewards.teamSubjects();
    return teams.map((team) => ({
      key: `team:${team.teamId}`,
      userId: null,
      teamId: team.teamId,
      members: new Set(team.memberUserIds),
    }));
  }

  /** Loads the current and previous period once for every subject. */
  private async periodFacts(
    stores: RewardStores,
    userIds: readonly string[],
    period: RewardPeriodRange,
    policy: RewardPolicyRecord,
    timeZone: string,
  ): Promise<PeriodFacts> {
    const startOf = (date: CalendarDate) => zonedTimeToInstant(date, '00:00', timeZone);
    const previous = previousRewardPeriod(period, policy.period);
    const current = { from: startOf(period.start), to: startOf(addDays(period.end, 1)) };
    const previousWindow = { from: startOf(previous.start), to: current.from };
    // Sequential: these run inside the command's transaction, on one connection.
    const tasks = await stores.rewards.completedTasks(userIds, previousWindow.from, current.to);
    const blockers = await stores.rewards.blockerReports(userIds, current.from, current.to);
    const milestones = await stores.rewards.completedMilestones(current.from, current.to);
    return { tasks, blockers, milestones, current, previous: previousWindow, timeZone };
  }

  private evaluate(
    policy: RewardPolicyRecord,
    subject: RewardSubject,
    facts: PeriodFacts,
    context: FactContext,
  ) {
    const outcomes = taskOutcomesFor(subject.members, facts.tasks, facts.current, context);
    const metrics = buildRewardMetrics({
      outcomes,
      blockerReports: blockerReportsFor(
        subject.members,
        facts.blockers,
        facts.current,
        facts.timeZone,
      ),
      milestonesDeliveredOnTime: milestonesDeliveredOnTime(
        subject.members,
        facts.milestones,
        facts.current,
        facts.timeZone,
      ),
      previousOnTimeRate: onTimeRateOf(
        taskOutcomesFor(subject.members, facts.tasks, facts.previous, context),
      ),
    });
    const eligibility = evaluateRewardEligibility(policy.criteria, metrics);
    return {
      eligible: eligibility.eligible,
      summary: eligibility.summary,
      evidence: {
        criteria: eligibility.criteria,
        metrics: metricsEvidence(metrics, policy.criteria),
        policyVersion: policy.version,
      },
    };
  }
}
