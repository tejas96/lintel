import type { MilestoneHealth, MilestoneRiskAssessment, ProjectHealth } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';

export interface MilestoneRiskFact {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string;
  readonly assessment: MilestoneRiskAssessment;
}

export interface ProjectRiskFacts {
  readonly projectId: string;
  readonly name: string;
  readonly reference: string;
  readonly managerUserId: string;
  readonly health: ProjectHealth;
  readonly milestones: readonly MilestoneRiskFact[];
}

/** Activity type recording each milestone health change (the "memory" of daily checks). */
export const MILESTONE_HEALTH_ACTIVITY = 'milestone.health_changed';

/** Facts for the daily operations run (risk alerts). */
export interface DailyOperationsStore {
  /** Health of every active project, computed with the domain calculators. */
  activeProjectRisks(today: CalendarDate): Promise<ProjectRiskFacts[]>;
  /** The last health recorded per milestone by earlier daily runs. */
  lastRecordedMilestoneHealth(
    milestoneIds: readonly string[],
  ): Promise<Map<string, MilestoneHealth>>;
  notificationExists(recipientUserId: string, dedupeKey: string): Promise<boolean>;
}
