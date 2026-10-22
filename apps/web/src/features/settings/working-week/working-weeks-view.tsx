'use client';

import type { ManagedWorkingCalendar } from '@lintel/api-contracts';
import {
  Button,
  ErrorState,
  IconButton,
  listItemEnter,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from '@lintel/design-system/web';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { StudioWeekCard } from './studio-week-card';
import {
  useWorkingCalendarMutations,
  useWorkingCalendars,
  workingCalendarsKey,
} from './use-working-calendars';
import { describeWeek } from './working-week-form';
import { WorkingWeekSheet, type WorkingWeekSheetMode } from './working-week-sheet';

function OtherWeekRow({
  calendar,
  onEdit,
  onRemove,
  removing,
}: {
  readonly calendar: ManagedWorkingCalendar;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
  readonly removing: boolean;
}) {
  const people = calendar.peopleCount === 1 ? '1 person' : `${calendar.peopleCount} people`;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="type-title-md text-ink">{calendar.name}</h3>
        <p className="type-body-sm text-ink-muted">{describeWeek(calendar)}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <p className="flex items-center gap-1.5 type-body-sm text-ink-faint">
          <Users aria-hidden className="size-3.5" />
          {calendar.peopleCount === 0 ? 'Nobody yet' : people}
        </p>
        <div className="flex gap-1">
          <IconButton label={`Edit ${calendar.name}`} size="sm" onClick={onEdit}>
            <Pencil aria-hidden />
          </IconButton>
          <IconButton
            label={
              calendar.peopleCount > 0
                ? `${calendar.name} cannot be removed while ${people} follow it`
                : `Remove ${calendar.name}`
            }
            size="sm"
            disabled={calendar.peopleCount > 0 || removing}
            onClick={onRemove}
          >
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

/** The studio week and the other working weeks people can be assigned to. */
export function WorkingWeeksView() {
  const toast = useToast();
  const fail = useFailureToast();
  const calendars = useWorkingCalendars();
  const { remove } = useWorkingCalendarMutations();
  const [sheet, setSheet] = useState<WorkingWeekSheetMode>(null);

  if (calendars.isPending)
    return (
      <SkeletonGroup label="Loading working weeks">
        <SkeletonText lines={8} />
      </SkeletonGroup>
    );
  if (calendars.isError)
    return (
      <ErrorState
        {...describeError(calendars.error, { resource: 'collection' })}
        onRetry={() => calendars.refetch()}
      />
    );
  const studio = calendars.data.find((calendar) => calendar.isDefault);
  const others = calendars.data.filter((calendar) => !calendar.isDefault);
  const refresh = () => void calendars.refetch();

  return (
    <div className="flex flex-col gap-10">
      {studio && <StudioWeekCard key={studio.version} calendar={studio} onRefresh={refresh} />}
      <section aria-labelledby="other-weeks" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="other-weeks" className="type-title-lg text-ink">
              Other working weeks
            </h2>
            <p className="type-body-sm text-ink-muted">
              For people who work different days or hours. Studio holidays apply to every week.
            </p>
          </div>
          <Button leadingIcon={<Plus aria-hidden />} onClick={() => setSheet('add')}>
            Add a working week
          </Button>
        </div>
        {others.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule px-5 py-6 type-body-sm text-ink-muted">
            Everyone follows the studio week. Add another week for part-timers or a site team, then
            choose it for them under People.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-raised">
            {others.map((calendar, index) => (
              <motion.li key={calendar.id} {...listItemEnter(index)}>
                <OtherWeekRow
                  calendar={calendar}
                  onEdit={() => setSheet(calendar)}
                  removing={remove.isPending && remove.variables?.id === calendar.id}
                  onRemove={() =>
                    remove.mutate(calendar, {
                      onSuccess: () =>
                        toast({
                          tone: 'success',
                          title: 'Working week removed',
                          description: calendar.name,
                        }),
                      onError: (error) =>
                        fail(error, 'remove the working week', [workingCalendarsKey]),
                    })
                  }
                />
              </motion.li>
            ))}
          </ul>
        )}
      </section>
      <WorkingWeekSheet
        mode={sheet}
        studio={studio}
        onClose={() => setSheet(null)}
        onRefresh={refresh}
      />
    </div>
  );
}
