'use client';

import type { RiskCardItem } from '@lintel/api-contracts';
import { Avatar, cn, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { ArrowRight, BellRing, Clock3 } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ProjectChip } from '@/features/tasks/task-presentation';
import { formatCalendarDate, withReadableDates } from '@/lib/format/dates';
import { NO_ESCALATION, ROLE_LABELS, RULE_LABELS, severityOf } from './risk-presentation';

function alsoDelays(card: RiskCardItem): string {
  return card.alsoAffects
    .map(
      (item) =>
        `${item.kind === 'delivery' ? 'the planned delivery' : item.name}${item.slipWorkingDays > 0 ? ` (+${item.slipWorkingDays})` : ''}`,
    )
    .join(' · ');
}

/** The slip as a display number beside the forecast, or why nothing slips yet. */
function Impact({ card, today }: { readonly card: RiskCardItem; readonly today: string }) {
  const slip = card.impact.slipWorkingDays;
  return (
    <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-3 rounded-md bg-sunken/70 px-3.5 py-3">
      <p className="flex flex-col">
        <span
          className={cn(
            'font-display text-[1.75rem] leading-none tabular-nums',
            slip > 0 ? 'text-overdue' : 'text-ink',
          )}
        >
          {slip > 0 ? `+${slip}` : '0'}
        </span>
        <span className="mt-1 type-label text-ink-faint">
          {slip === 1 ? 'working day' : 'working days'}
        </span>
      </p>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-body-sm text-ink">
          {slip > 0 && card.impact.forecastDate
            ? `Forecast ${formatCalendarDate(card.impact.forecastDate, today)} instead of ${formatCalendarDate(card.commitment.dueDate, today)}`
            : withReadableDates(card.impact.summary)}
        </p>
        {card.alsoAffects.length > 0 && (
          <p className="type-body-sm text-ink-muted">
            <span className="text-ink-faint">Also delays </span>
            {alsoDelays(card)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * One risk, explained: what is happening, the forecast slip, the next action
 * (a link to where it is done), who acts, and when it escalates if nobody does.
 */
export function RiskCard({
  card,
  today,
  index = 0,
  showProject = true,
}: {
  readonly card: RiskCardItem;
  readonly today: string;
  readonly index?: number;
  readonly showProject?: boolean;
}) {
  const severity = severityOf(card);
  const person = card.responsible.user;
  const escalation = card.escalation;
  return (
    <motion.li
      {...listItemEnter(index)}
      className="flex min-w-0 flex-col gap-4 rounded-lg border border-hairline bg-raised p-5"
    >
      <header className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="type-overline text-ink-faint">{RULE_LABELS[card.rule]}</p>
          <StatusPill
            tone={severity.tone}
            glyph={severity.glyph}
            label={severity.label}
            size="sm"
          />
        </div>
        <h3 className="type-title-md text-ink">
          {card.commitment.kind === 'delivery' ? 'Planned delivery' : card.commitment.name}
          <span className="font-normal text-ink-faint">
            {' '}
            · due {formatCalendarDate(card.commitment.dueDate, today)}
          </span>
        </h3>
        {showProject && <ProjectChip project={card.project} />}
      </header>
      <p className="type-body-sm text-ink">{withReadableDates(card.happening)}</p>
      <Impact card={card} today={today} />
      <Link
        href={card.nextAction.linkPath}
        className="group inline-flex min-h-11 items-center justify-between gap-3 rounded-md border border-accent/25 bg-accent-soft/50 px-3.5 py-2.5 type-body-sm font-medium text-on-accent-soft transition-colors hover:bg-accent-soft"
      >
        <span className="min-w-0">
          <span className="block type-label text-on-accent-soft/70">Next action</span>
          <span className="block">{card.nextAction.label}</span>
        </span>
        <ArrowRight
          aria-hidden
          className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
      <footer className="flex flex-col gap-2.5 border-t border-hairline pt-3.5">
        <p className="flex min-w-0 items-center gap-2 type-body-sm text-ink-muted">
          {person ? (
            <>
              <Avatar name={person.fullName} hue={person.avatarHue} size="xs" decorative />
              <span className="truncate">
                <span className="font-medium text-ink">{person.fullName}</span>
                {' · '}
                {ROLE_LABELS[card.responsible.role]}
              </span>
            </>
          ) : (
            <span>{ROLE_LABELS[card.responsible.role]}: nobody chosen yet</span>
          )}
        </p>
        <p
          className={cn(
            'flex items-start gap-2 type-body-sm',
            escalation?.alreadyHappened ? 'text-overdue' : 'text-ink-muted',
          )}
        >
          {escalation?.alreadyHappened ? (
            <BellRing aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          )}
          <span>
            {escalation ? withReadableDates(escalation.summary) : NO_ESCALATION[card.rule]}
          </span>
        </p>
      </footer>
    </motion.li>
  );
}
