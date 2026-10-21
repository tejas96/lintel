'use client';

import type { ManagedLeaveType } from '@lintel/api-contracts';
import { Badge, Button, cn, StatusPill } from '@lintel/design-system/web';
import { Archive, Pencil, RotateCcw } from 'lucide-react';
import { formatHalfDays } from '@/features/leave/use-leave';
import { swatchClass } from '@/features/tasks/task-presentation';

function rulesOf(type: ManagedLeaveType): string[] {
  return [
    type.allowsHalfDay ? 'Half days allowed' : 'Full days only',
    type.requiresReason ? 'Reason required' : 'No reason needed',
    type.minimumNoticeDays > 0
      ? `${type.minimumNoticeDays} ${type.minimumNoticeDays === 1 ? 'day' : 'days'} notice`
      : 'No notice needed',
    type.annualAllowanceHalfDays === null
      ? 'No yearly allowance'
      : `${formatHalfDays(type.annualAllowanceHalfDays)} a year`,
  ];
}

function usageOf(type: ManagedLeaveType): string {
  if (type.requestCount === 0) return 'Not used yet';
  const total = `${type.requestCount} ${type.requestCount === 1 ? 'request' : 'requests'}`;
  return type.openRequestCount > 0 ? `${total}, ${type.openRequestCount} waiting` : total;
}

interface LeaveTypeRowProps {
  readonly type: ManagedLeaveType;
  readonly onEdit: () => void;
  readonly onRetire: () => void;
  readonly onReactivate: () => void;
  readonly reactivating: boolean;
}

/** One leave type: its colour, name, rules, how often it is used and what can be done. */
export function LeaveTypeRow({
  type,
  onEdit,
  onRetire,
  onReactivate,
  reactivating,
}: LeaveTypeRowProps) {
  const retired = !type.isActive;
  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:gap-5 sm:px-5">
      <span
        aria-hidden
        className={cn(
          'hidden h-10 w-1 shrink-0 rounded-full sm:block',
          swatchClass(type.colorIndex),
          retired && 'opacity-40',
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            aria-hidden
            className={cn('size-2.5 rounded-[3px] sm:hidden', swatchClass(type.colorIndex))}
          />
          <h3 className={cn('type-title-md', retired ? 'text-ink-muted' : 'text-ink')}>
            {type.name}
          </h3>
          <StatusPill
            size="sm"
            tone={retired ? 'neutral' : 'onTrack'}
            glyph={retired ? 'cancelled' : 'onTrack'}
            label={retired ? 'Retired' : 'Offered'}
          />
        </div>
        {type.description && (
          <p className="max-w-prose type-body-sm text-ink-muted">{type.description}</p>
        )}
        <ul className="flex flex-wrap gap-1.5" aria-label={`Rules for ${type.name}`}>
          {rulesOf(type).map((rule) => (
            <li key={rule}>
              <Badge variant="soft">{rule}</Badge>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[0.75rem] text-ink-faint">{usageOf(type)}</p>
      </div>
      <div className="flex shrink-0 gap-1 sm:flex-col sm:items-end lg:flex-row lg:items-center">
        <Button
          size="sm"
          variant="quiet"
          leadingIcon={<Pencil aria-hidden />}
          onClick={onEdit}
          aria-label={`Edit ${type.name}`}
        >
          Edit
        </Button>
        {retired ? (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<RotateCcw aria-hidden />}
            onClick={onReactivate}
            pending={reactivating}
            aria-label={`Offer ${type.name} again`}
          >
            Offer again
          </Button>
        ) : (
          <Button
            size="sm"
            variant="quiet"
            leadingIcon={<Archive aria-hidden />}
            onClick={onRetire}
            aria-label={`Retire ${type.name}`}
          >
            Retire
          </Button>
        )}
      </div>
    </div>
  );
}
