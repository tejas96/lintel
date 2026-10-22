import type { DirectoryEntry } from '@lintel/api-contracts';
import { Avatar, cn, type TableColumn } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { formatRelativeInstant } from '@/lib/format/dates';

/** Short values stay on one line; columns drop out at narrower widths instead of wrapping. */
const NO_WRAP = 'whitespace-nowrap';

/**
 * The directory's columns. With `onOpen`, the person's name is a button that
 * covers the whole row, so administrators can open anyone to edit them.
 */
export function peopleColumns(
  onOpen: ((person: DirectoryEntry) => void) | null,
): TableColumn<DirectoryEntry>[] {
  return [
    {
      key: 'person',
      header: 'Person',
      primary: true,
      // Takes the spare width and truncates long names rather than squeezing other columns.
      className: 'w-full max-w-0',
      cell: (person) => (
        <span
          className={cn('flex items-center gap-3', person.status === 'deactivated' && 'opacity-60')}
        >
          <Avatar name={person.fullName} hue={person.avatarHue} size="sm" decorative />
          <span className="flex min-w-0 flex-col">
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(person)}
                className="lt-stretched-link truncate rounded-sm text-left font-medium text-ink"
              >
                {person.fullName}
              </button>
            ) : (
              <span className="truncate font-medium text-ink">{person.fullName}</span>
            )}
            <span className="truncate type-body-sm text-ink-faint">
              {person.designation ?? ROLE_LABELS[person.role]}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      className: NO_WRAP,
      cell: (person) => <span className="text-ink-muted">{ROLE_LABELS[person.role]}</span>,
    },
    {
      key: 'team',
      header: 'Team',
      className: NO_WRAP,
      cell: (person) => <span className="text-ink-muted">{person.team?.name ?? 'No team'}</span>,
    },
    {
      key: 'reports',
      header: 'Reports to',
      hideOnPhone: true,
      className: `${NO_WRAP} hidden xl:table-cell`,
      cell: (person) => (
        <span className="text-ink-muted">{person.reportsTo?.fullName ?? 'Nobody'}</span>
      ),
    },
    {
      key: 'capacity',
      header: 'Works',
      hideOnPhone: true,
      className: `${NO_WRAP} hidden lg:table-cell`,
      align: 'end',
      cell: (person) => (
        <span className="text-ink-muted tabular-nums">{person.capacityPercent}%</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideOnPhone: true,
      className: `${NO_WRAP} hidden xl:table-cell`,
      cell: (person) => (
        <span className="font-mono text-[0.8125rem] text-ink-muted">{person.maskedPhone}</span>
      ),
    },
    {
      key: 'active',
      header: 'Last active',
      align: 'end',
      className: NO_WRAP,
      cell: (person) => (
        <span className="text-ink-faint">
          {person.status === 'deactivated'
            ? 'Deactivated'
            : person.lastActiveAt
              ? formatRelativeInstant(person.lastActiveAt)
              : 'Not yet'}
        </span>
      ),
    },
  ];
}
