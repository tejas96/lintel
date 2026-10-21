import type { ProjectHealthView, ProjectSummary } from '@lintel/api-contracts';
import {
  type PillTone,
  type StatusGlyphName,
  StatusPill,
  Tooltip,
  type TrackerStage,
} from '@lintel/design-system/web';
import type { ProjectStatus } from '@lintel/domain';
import { withReadableDates } from '@/lib/format/dates';

type HealthStatus = ProjectHealthView['status'];

export const HEALTH_PRESENTATION: Readonly<
  Record<HealthStatus, { tone: PillTone; glyph: StatusGlyphName; label: string }>
> = {
  not_started: { tone: 'neutral', glyph: 'notStarted', label: 'Not started' },
  on_track: { tone: 'onTrack', glyph: 'onTrack', label: 'On track' },
  at_risk: { tone: 'atRisk', glyph: 'atRisk', label: 'At risk' },
  off_track: { tone: 'overdue', glyph: 'offTrack', label: 'Off track' },
  closed: { tone: 'done', glyph: 'done', label: 'Closed' },
};

export const PROJECT_STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
  draft: 'Draft',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

/** Health as colour + glyph + word; the server's reasons appear on hover and focus. */
export function HealthPill({
  health,
  size = 'sm',
}: {
  readonly health: ProjectHealthView;
  readonly size?: 'sm' | 'md';
}) {
  const presentation = HEALTH_PRESENTATION[health.status];
  const pill = (
    <StatusPill
      tone={presentation.tone}
      glyph={presentation.glyph}
      label={presentation.label}
      size={size}
    />
  );
  if (health.reasons.length === 0) return pill;
  return (
    <Tooltip
      content={
        <ul className="flex flex-col gap-1">
          {health.reasons.map((reason) => (
            <li key={reason.message}>{withReadableDates(reason.message)}</li>
          ))}
        </ul>
      }
    >
      <button
        type="button"
        className="rounded-full"
        aria-label={`${presentation.label}: ${health.reasons.map((reason) => withReadableDates(reason.message)).join(' ')}`}
      >
        {pill}
      </button>
    </Tooltip>
  );
}

/**
 * Stage segments from a project summary, which only knows the current stage:
 * earlier stages count as complete and later ones as not started.
 */
export function stagesFromSummary(project: ProjectSummary): TrackerStage[] {
  const current = project.currentStage;
  if (!current) return [];
  return Array.from({ length: current.totalStages }, (_, index) => ({
    id: `${project.id}-stage-${index}`,
    name: index === current.position ? current.name : `Stage ${index + 1}`,
    status:
      index < current.position ? 'completed' : index === current.position ? 'active' : 'pending',
    progress: 1,
  }));
}

/** Share of the project's tasks that are finished (0–1). */
export function completionShare(health: ProjectHealthView): number {
  const total = health.completedTaskCount + health.openTaskCount;
  return total === 0 ? 0 : health.completedTaskCount / total;
}
