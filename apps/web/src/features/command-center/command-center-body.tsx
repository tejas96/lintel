'use client';

import type { CommandCenter, CommandCenterBriefing } from '@lintel/api-contracts';
import { ProjectCard } from '@/features/projects/project-card';
import { DeadlinesAhead, OwnerInterventions, PerformanceHighlights } from './briefing-panels';
import { BusinessHealthCard } from './business-health-card';
import { CommandCenterBudgets } from './command-center-budgets';
import { CommandCenterKpis } from './command-center-kpis';
import {
  DecisionsWaiting,
  StuckWork,
  TeamPulse,
  UpcomingMilestones,
} from './command-center-panels';
import { CommandCenterRisks } from './command-center-risks';

function ProjectsNeedingAttention({
  data,
  today,
  narrowed,
}: {
  readonly data: CommandCenter;
  readonly today: string;
  readonly narrowed: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-title-md text-ink">Projects needing attention</h2>
      {data.projectsNeedingAttention.length === 0 ? (
        <p className="type-body-sm text-ink-faint">
          {narrowed
            ? 'Every open project in this view is on track.'
            : 'Every open project is on track.'}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.projectsNeedingAttention.map((project, index) => (
            <ProjectCard key={project.id} project={project} today={today} index={index} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The command center in reading order: the health score and what was escalated
 * to the owner, the live numbers, then what could slip (with the next action)
 * beside decisions, deadlines, stuck work, the team and highlights.
 */
export function CommandCenterBody({
  data,
  briefing,
  today,
  narrowed,
  stale,
}: {
  readonly data: CommandCenter;
  /** Loaded separately; its sections appear when it arrives. */
  readonly briefing: CommandCenterBriefing | undefined;
  readonly today: string;
  readonly narrowed: boolean;
  /** The previous filter's numbers are on screen while the new ones load. */
  readonly stale: boolean;
}) {
  return (
    <div
      aria-busy={stale}
      className={
        stale
          ? 'flex flex-col gap-8 opacity-60 transition-opacity'
          : 'flex flex-col gap-8 transition-opacity'
      }
    >
      {briefing && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <BusinessHealthCard health={briefing.health} today={today} />
          <OwnerInterventions items={briefing.interventions} />
        </div>
      )}
      <CommandCenterKpis data={data} today={today} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {briefing && <CommandCenterRisks briefing={briefing} today={today} filtered={narrowed} />}
          <ProjectsNeedingAttention data={data} today={today} narrowed={narrowed} />
          <UpcomingMilestones data={data} today={today} filtered={narrowed} />
          {data.profitability && <CommandCenterBudgets portfolio={data.profitability} />}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <DecisionsWaiting data={data} />
          {briefing && <DeadlinesAhead deadlines={briefing.deadlines} today={today} />}
          <StuckWork data={data} today={today} />
          <TeamPulse data={data} />
          {briefing && <PerformanceHighlights highlights={briefing.highlights} today={today} />}
        </div>
      </div>
    </div>
  );
}
