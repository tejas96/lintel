import type { LeaveImpact } from '@lintel/api-contracts';
import { Avatar, StatusGlyph } from '@lintel/design-system/web';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { formatCalendarDate, withReadableDates } from '@/lib/format/dates';

/**
 * What the leave touches, as the server worked it out: working days, work due
 * or planned in the period, teammates already away, and policy warnings.
 */
export function LeaveImpactSummary({
  impact,
  today,
  subject,
}: {
  readonly impact: LeaveImpact;
  readonly today: string;
  /** Whose leave it is, when it is not the viewer's own ("Dev"). */
  readonly subject?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="type-display-md text-ink">{impact.durationLabel}</p>
        <p className="type-body-sm text-ink-muted">
          {impact.approvalLevels <= 1
            ? 'Needs one approval'
            : `Needs ${impact.approvalLevels} approvals, one after the other`}
        </p>
      </div>
      {impact.blockingProblems.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-md border border-overdue-solid/30 bg-overdue-tint/50 p-3">
          {impact.blockingProblems.map((problem) => (
            <li key={problem} className="flex items-start gap-2 type-body-sm text-ink">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-overdue" />
              {problem}
            </li>
          ))}
        </ul>
      )}
      {impact.conflicts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="type-title-md text-ink">Work affected</h3>
          <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-raised">
            {impact.conflicts.map((conflict) => (
              <li key={`${conflict.taskId}-${conflict.kind}`} className="flex gap-3 p-3">
                <StatusGlyph
                  name={conflict.severity === 'critical' ? 'overdue' : 'atRisk'}
                  className={
                    conflict.severity === 'critical'
                      ? 'mt-0.5 size-4 text-overdue'
                      : 'mt-0.5 size-4 text-at-risk'
                  }
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="type-body-sm font-medium text-ink">
                    {conflict.title}
                    <span className="font-normal text-ink-faint"> in {conflict.projectName}</span>
                    <span className="sr-only">
                      {conflict.severity === 'critical' ? ' (critical)' : ' (warning)'}
                    </span>
                  </p>
                  <p className="type-body-sm text-ink-muted">
                    {withReadableDates(conflict.explanation)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {impact.overlappingAbsences.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="type-title-md text-ink">Also away</h3>
          <ul className="flex flex-col gap-2">
            {impact.overlappingAbsences.map((absence) => (
              <li
                key={absence.user.id}
                className="flex items-center gap-2 type-body-sm text-ink-muted"
              >
                <Avatar
                  name={absence.user.fullName}
                  hue={absence.user.avatarHue}
                  size="xs"
                  decorative
                />
                <span className="text-ink">{absence.user.fullName}</span>
                {absence.dates.length > 0 && (
                  <span>
                    {formatCalendarDate(absence.dates[0] ?? today, today)}
                    {absence.dates.length > 1 &&
                      ` to ${formatCalendarDate(absence.dates[absence.dates.length - 1] ?? today, today)}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {impact.warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {impact.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 type-body-sm text-ink-muted">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-at-risk" />
              {warning}
            </li>
          ))}
        </ul>
      )}
      {impact.conflicts.length === 0 &&
        impact.overlappingAbsences.length === 0 &&
        impact.blockingProblems.length === 0 && (
          <p className="type-body-sm text-ink-muted">
            {subject
              ? `Nothing ${subject} owns is due or planned in these days, and nobody else on their team is away.`
              : 'Nothing you own is due or planned in these days, and nobody else on your team is away.'}
          </p>
        )}
    </div>
  );
}
