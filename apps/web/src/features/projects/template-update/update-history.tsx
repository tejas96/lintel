import type { TemplateUpdateStatus } from '@lintel/api-contracts';
import { Card, CardHeader } from '@lintel/design-system/web';
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';

/** Every earlier move to a newer template version, newest first. */
export function UpdateHistory({
  history,
  today,
}: {
  readonly history: TemplateUpdateStatus['history'];
  readonly today: string;
}) {
  if (history.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Earlier updates"
        description="Each one is also in the project’s activity."
      />
      <ol className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {history.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1 px-5 py-3">
            <p className="type-body-sm text-ink">
              <span className="font-medium">
                Version {entry.fromVersionNumber} → {entry.toVersionNumber}
              </span>
              <span className="text-ink-muted">
                {' '}
                by {entry.appliedBy?.fullName ?? 'a former member'},{' '}
                {formatRelativeInstant(entry.appliedAt)}
              </span>
            </p>
            <p className="type-body-sm text-ink-faint">
              {entry.added} added · {entry.changed} changed · {entry.cancelled} cancelled ·{' '}
              {entry.heldBack} left as they were
              {entry.extendedPlannedEndTo &&
                ` · planned end moved to ${formatCalendarDate(entry.extendedPlannedEndTo, today)}`}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
