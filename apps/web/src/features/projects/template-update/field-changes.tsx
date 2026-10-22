import type { TemplateUpdateItem } from '@lintel/api-contracts';
import { cn } from '@lintel/design-system/web';
import type { TaskPriority } from '@lintel/domain';
import { pluralize } from '@lintel/shared';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { PRIORITY_LABELS } from '@/features/templates/template-types';
import { formatCalendarDate, formatMinutes } from '@/lib/format/dates';

type Field = TemplateUpdateItem['fields'][number];

const FIELD_LABELS: Readonly<Record<Field['field'], string>> = {
  name: 'Name',
  description: 'Description',
  title: 'Title',
  priority: 'Priority',
  requiresReview: 'Review',
  estimateMinutes: 'Estimate',
  escalateAfterOverdueDays: 'Escalation',
  requiresClientApproval: 'Client approval',
  stage: 'Stage',
  milestone: 'Milestone',
  duration: 'Length',
  checklist: 'Checklist',
  prerequisites: 'Waits for',
  deliverables: 'Deliverables',
};

function readable(field: Field['field'], value: string | null): string {
  if (value === null || value === '') return 'None';
  if (field === 'priority') return PRIORITY_LABELS[value as TaskPriority] ?? value;
  if (field === 'requiresReview') return value === 'true' ? 'Needed' : 'Not needed';
  if (field === 'requiresClientApproval') return value === 'true' ? 'Needed' : 'Not needed';
  if (field === 'estimateMinutes') return formatMinutes(Number(value));
  if (field === 'escalateAfterOverdueDays')
    return `After ${pluralize(Number(value), 'working day')} overdue`;
  if (field === 'duration') return `${value} working ${value === '1' ? 'day' : 'days'}`;
  return value;
}

type Shown = Field['outcome'] | 'ticked' | 'none';

function Outcome({ shown }: { readonly shown: Shown }) {
  if (shown === 'held') {
    return (
      <span className="inline-flex items-center gap-1 text-ink-faint">
        <Lock aria-hidden className="size-3" />
        Held until you tick it
      </span>
    );
  }
  if (shown === 'ticked') {
    return (
      <span className="inline-flex items-center gap-1 text-ink-muted">
        <Check aria-hidden className="size-3" />
        Applies, as you ticked it
      </span>
    );
  }
  if (shown === 'kept')
    return <span className="text-ink-faint">Kept: this project changed it</span>;
  if (shown === 'unavailable')
    return <span className="text-ink-faint">Stays: that one is not added to this project</span>;
  return null;
}

/** Blocked items never change, so their fields need no outcome; ticked held fields apply. */
function shownOutcome(field: Field, item: TemplateUpdateItem, ticked: boolean): Shown {
  if (item.blocked) return 'none';
  if (field.outcome === 'held' && ticked) return 'ticked';
  return field.outcome;
}

/** What changes on one item, field by field, with what is held back and what this project kept. */
export function FieldChanges({
  item,
  today,
  ticked,
}: {
  readonly item: TemplateUpdateItem;
  readonly today: string;
  readonly ticked: boolean;
}) {
  if (item.fields.length === 0) return null;
  return (
    <dl className="flex flex-col gap-2 rounded-md bg-sunken/60 px-3 py-2.5">
      {item.fields.map((field) => {
        const isList = field.added.length > 0 || field.removed.length > 0;
        const shown = shownOutcome(field, item, ticked);
        const muted = shown !== 'apply' && shown !== 'ticked';
        return (
          <div
            key={field.field}
            className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0.5 sm:grid-cols-[7.5rem_minmax(0,1fr)]"
          >
            <dt className="flex flex-wrap items-center gap-x-2 type-body-sm text-ink-faint">
              {FIELD_LABELS[field.field]}
              <span className="sm:hidden">
                <Outcome shown={shown} />
              </span>
            </dt>
            <dd
              className={cn(
                'flex min-w-0 flex-col gap-0.5 type-body-sm',
                muted ? 'text-ink-muted' : 'text-ink',
              )}
            >
              {isList ? (
                <ul className="flex flex-col gap-0.5">
                  {field.added.map((entry) => (
                    <li key={`+${entry}`} className="flex gap-1.5">
                      <span aria-hidden className="font-mono text-on-track">
                        +
                      </span>
                      <span className="sr-only">Adds</span>
                      {entry}
                    </li>
                  ))}
                  {field.removed.map((entry) => (
                    <li key={`-${entry}`} className="flex gap-1.5">
                      <span aria-hidden className="font-mono text-overdue">
                        −
                      </span>
                      <span className="sr-only">Removes</span>
                      <span className="line-through decoration-ink-faint">{entry}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="flex flex-wrap items-center gap-x-1.5">
                  <span className="text-ink-muted">{readable(field.field, field.from)}</span>
                  <ArrowRight aria-hidden className="size-3.5 text-ink-faint" />
                  <span className="sr-only">becomes</span>
                  <span className={cn(!muted && 'font-medium')}>
                    {readable(field.field, field.to)}
                  </span>
                </span>
              )}
              {field.field === 'duration' && item.dates?.toDue && (
                <span className="text-ink-faint">
                  Due{' '}
                  {item.dates.fromDue ? formatCalendarDate(item.dates.fromDue, today) : 'not set'} →{' '}
                  {formatCalendarDate(item.dates.toDue, today)}
                </span>
              )}
              <span className="hidden sm:inline">
                <Outcome shown={shown} />
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
