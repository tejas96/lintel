import type { PersonCapacity } from '@lintel/api-contracts';
import { Avatar, cn, StatusGlyph } from '@lintel/design-system/web';
import { formatHoursShort, LOAD_PRESENTATION } from './load-presentation';

/**
 * Who, their load ring, and the range in one line: booked of available hours
 * and the load in words. A hollow mark flags assumed estimates.
 */
export function PersonLoad({
  person,
  size = 'md',
}: {
  readonly person: PersonCapacity;
  readonly size?: 'md' | 'lg';
}) {
  const presentation = LOAD_PRESENTATION[person.status];
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar
        name={person.user.fullName}
        hue={person.user.avatarHue}
        size={size}
        load={{ utilization: person.utilization, status: person.status }}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate type-body-sm font-medium text-ink">
          {person.user.fullName}
          {person.usesDefaultEstimates && (
            <span className="ml-1 text-ink-faint" title="Some tasks use an assumed estimate">
              ◌<span className="sr-only">, some tasks use an assumed estimate</span>
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-muted">
          <StatusGlyph name={presentation.glyph} className={cn('size-3', presentation.text)} />
          <span className={presentation.text}>{presentation.label}</span>
          <span className="truncate text-ink-faint">
            {formatHoursShort(person.confirmedMinutes)} of{' '}
            {formatHoursShort(person.availableMinutes)}
          </span>
        </span>
      </span>
    </span>
  );
}
