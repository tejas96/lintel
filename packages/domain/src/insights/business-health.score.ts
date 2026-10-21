/**
 * The business health score (0–100), formula version "health-v1". Every
 * input is a count of live records; docs/PRODUCT_REQUIREMENTS.md §15.1 has
 * the formula in plain words. 100 means nothing in view needs attention.
 */
export const BUSINESS_HEALTH_FORMULA = 'health-v1';

export const HEALTH_COMPONENTS = [
  'delivery_risk',
  'overdue_work',
  'blocked_work',
  'decisions_waiting',
  'capacity_strain',
] as const;
export type HealthComponentKey = (typeof HEALTH_COMPONENTS)[number];

export interface BusinessHealthInputs {
  readonly activeProjects: number;
  readonly projectsOffTrack: number;
  readonly projectsAtRisk: number;
  readonly openTasks: number;
  readonly overdueTasks: number;
  readonly blockedTasks: number;
  /** Decisions (reviews, leave, scope changes, handovers, new dates) waiting longer than the grace time. */
  readonly staleDecisions: number;
  readonly peopleInView: number;
  readonly overloadedPeople: number;
}

export interface HealthComponent {
  readonly key: HealthComponentKey;
  /** Most points this part can take away. */
  readonly weight: number;
  /** Points taken away now (0 … weight, one decimal). */
  readonly penalty: number;
  /** The measured share or count, as used by the formula. */
  readonly measure: number;
  readonly summary: string;
}

export interface BusinessHealthScore {
  readonly formula: string;
  readonly score: number;
  readonly band: 'healthy' | 'watch' | 'at_risk' | 'critical';
  readonly components: readonly HealthComponent[];
  /** Up to three components with the largest penalty (only those above zero). */
  readonly contributors: readonly HealthComponent[];
}

/** Each part: its weight and the measure at which it takes the whole weight. */
export const HEALTH_WEIGHTS: Readonly<
  Record<HealthComponentKey, { readonly weight: number; readonly fullAt: number }>
> = {
  delivery_risk: { weight: 30, fullAt: 0.5 },
  overdue_work: { weight: 25, fullAt: 0.2 },
  blocked_work: { weight: 15, fullAt: 0.1 },
  decisions_waiting: { weight: 15, fullAt: 5 },
  capacity_strain: { weight: 15, fullAt: 0.25 },
};

/** Hours a decision may wait before it counts as stale (two working days are 48 hours). */
export const DECISION_GRACE_HOURS = 48;

const share = (part: number, whole: number) => (whole <= 0 ? 0 : part / whole);
const round1 = (value: number) => Math.round(value * 10) / 10;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function penaltyOf(key: HealthComponentKey, measure: number): number {
  const { weight, fullAt } = HEALTH_WEIGHTS[key];
  return round1(weight * Math.min(1, measure / fullAt));
}

function component(key: HealthComponentKey, measure: number, summary: string): HealthComponent {
  return {
    key,
    weight: HEALTH_WEIGHTS[key].weight,
    penalty: penaltyOf(key, measure),
    measure: Math.round(measure * 1000) / 1000,
    summary,
  };
}

function bandOf(score: number): BusinessHealthScore['band'] {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'at_risk';
  return 'critical';
}

/**
 * Score = 100 − the sum of five penalties, each linear in its measure up to
 * its weight:
 * - delivery risk (30): (off track + ½ × at risk) ÷ active projects; full at 50 %;
 * - overdue work (25): overdue ÷ open tasks; full at 20 %;
 * - blocked work (15): blocked ÷ open tasks; full at 10 %;
 * - decisions waiting (15): decisions waiting over 48 hours; full at 5;
 * - capacity strain (15): overloaded people ÷ people in view; full at 25 %.
 */
export function scoreBusinessHealth(inputs: BusinessHealthInputs): BusinessHealthScore {
  const weightedProjects = inputs.projectsOffTrack + 0.5 * inputs.projectsAtRisk;
  const components: HealthComponent[] = [
    component(
      'delivery_risk',
      share(weightedProjects, inputs.activeProjects),
      `${plural(inputs.projectsOffTrack, 'project is', 'projects are')} off track and ${inputs.projectsAtRisk} at risk, of ${inputs.activeProjects} active.`,
    ),
    component(
      'overdue_work',
      share(inputs.overdueTasks, inputs.openTasks),
      `${plural(inputs.overdueTasks, 'open task is', 'open tasks are')} overdue, of ${inputs.openTasks}.`,
    ),
    component(
      'blocked_work',
      share(inputs.blockedTasks, inputs.openTasks),
      `${plural(inputs.blockedTasks, 'open task is', 'open tasks are')} blocked, of ${inputs.openTasks}.`,
    ),
    component(
      'decisions_waiting',
      inputs.staleDecisions,
      `${plural(inputs.staleDecisions, 'decision has', 'decisions have')} waited more than 2 days.`,
    ),
    component(
      'capacity_strain',
      share(inputs.overloadedPeople, inputs.peopleInView),
      `${plural(inputs.overloadedPeople, 'person is', 'people are')} overloaded this week, of ${inputs.peopleInView}.`,
    ),
  ];
  const lost = components.reduce((sum, part) => sum + part.penalty, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - lost)));
  const contributors = components
    .filter((part) => part.penalty > 0)
    .sort((left, right) => right.penalty - left.penalty)
    .slice(0, 3);
  return { formula: BUSINESS_HEALTH_FORMULA, score, band: bandOf(score), components, contributors };
}
