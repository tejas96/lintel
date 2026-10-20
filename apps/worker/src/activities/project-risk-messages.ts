import type { MilestoneRiskFact, NewNotification, ProjectRiskFacts } from '@lintel/application';
import { type MilestoneHealth, notificationDedupeKey } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';

const HEALTH_LABELS: Readonly<Record<MilestoneHealth, string>> = {
  completed: 'complete',
  on_track: 'on track',
  at_risk: 'at risk',
  missed: 'missed',
};

export function milestoneHealthLabel(health: MilestoneHealth): string {
  return HEALTH_LABELS[health];
}

/** One `project_at_risk` notification per project manager, project and day. */
export function projectRiskDedupeKey(project: ProjectRiskFacts, today: CalendarDate): string {
  return notificationDedupeKey({
    kind: 'project_at_risk',
    recipientId: project.managerUserId,
    subjectId: project.projectId,
    window: today,
  });
}

/**
 * Milestones whose health changed since the last daily run. A milestone with
 * no record counts as "on track" before, so a first run reports only risks.
 */
export function changedMilestones(
  project: ProjectRiskFacts,
  lastRecorded: ReadonlyMap<string, MilestoneHealth>,
): MilestoneRiskFact[] {
  return project.milestones.filter((milestone) => {
    const previous = lastRecorded.get(milestone.id);
    const current = milestone.assessment.health;
    if (previous === undefined) return current === 'at_risk' || current === 'missed';
    return previous !== current;
  });
}

export function isRisky(milestone: MilestoneRiskFact): boolean {
  return milestone.assessment.health === 'at_risk' || milestone.assessment.health === 'missed';
}

export function projectRiskNotification(
  project: ProjectRiskFacts,
  newlyRisky: readonly MilestoneRiskFact[],
  today: CalendarDate,
): NewNotification {
  const offTrack = project.health.status === 'off_track';
  const milestoneLines = newlyRisky.map((milestone) => {
    const reason = milestone.assessment.reasons[0];
    const label = milestoneHealthLabel(milestone.assessment.health);
    return `Milestone "${milestone.name}" is ${label}${reason ? `: ${reason}` : '.'}`;
  });
  const healthLines = offTrack
    ? project.health.reasons
        .filter((reason) => reason.severity === 'critical')
        .map((reason) => reason.message)
    : [];
  const title = offTrack
    ? `${project.reference} ${project.name} is off track`
    : `${project.reference} ${project.name}: milestone ${newlyRisky.length === 1 ? 'needs' : 'milestones need'} attention`;
  return {
    recipientUserId: project.managerUserId,
    kind: 'project_at_risk',
    title,
    body: [...milestoneLines, ...healthLines].join(' ').slice(0, 600),
    linkPath: `/projects/${project.projectId}`,
    subjectType: 'project',
    subjectId: project.projectId,
    dedupeKey: projectRiskDedupeKey(project, today),
    groupKey: `project:${project.projectId}`,
  };
}
