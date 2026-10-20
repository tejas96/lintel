'use client';

import {
  Button,
  DatePicker,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  listItemEnter,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from '@lintel/design-system/web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { formatLongDate, todayIn } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

/** Days the studio is closed. Task dates skip them. */
export function HolidaysList() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const [date, setDate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const holidays = useQuery({
    queryKey: queryKeys.holidays,
    queryFn: () => expectStatus(api.platform.listHolidays(), 200),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.holidays });
  const add = useMutation({
    mutationFn: (body: { date: string; name: string }) =>
      expectStatus(api.platform.addHoliday({ body }), 201),
    onSuccess: (holiday) => {
      void refresh();
      setDate(null);
      setName('');
      toast({ tone: 'success', title: 'Holiday added', description: holiday.name });
    },
    onError: (error) => fail(error, 'add the holiday'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => expectStatus(api.platform.removeHoliday({ params: { id } }), 204),
    onSuccess: () => void refresh(),
    onError: (error) => fail(error, 'remove the holiday', [queryKeys.holidays]),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (date && name.trim()) add.mutate({ date, name: name.trim() });
  };
  const sorted = [...(holidays.data ?? [])].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={submit}
        className="grid items-end gap-3 rounded-lg border border-hairline bg-raised p-4 sm:grid-cols-[14rem_1fr_auto]"
      >
        <Field label="Date">
          <DatePicker value={date} onValueChange={setDate} today={todayIn(user.timeZone)} />
        </Field>
        <Field label="Name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example: Diwali"
            maxLength={200}
          />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          leadingIcon={<Plus aria-hidden />}
          pending={add.isPending}
          disabled={!date || !name.trim()}
        >
          Add holiday
        </Button>
      </form>
      {holidays.isPending && (
        <SkeletonGroup label="Loading holidays">
          <SkeletonText lines={5} />
        </SkeletonGroup>
      )}
      {holidays.isError && (
        <ErrorState
          size="section"
          {...describeError(holidays.error, { resource: 'collection' })}
          onRetry={() => holidays.refetch()}
        />
      )}
      {holidays.data && sorted.length === 0 && (
        <EmptyState
          size="section"
          drawing="lamp"
          title="No holidays yet"
          description="Add the days the studio is closed so plans skip them."
        />
      )}
      {sorted.length > 0 && (
        <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-raised">
          {sorted.map((holiday, index) => (
            <motion.li
              key={holiday.id}
              {...listItemEnter(index)}
              className="flex items-center gap-4 px-4 py-2.5"
            >
              <span className="w-48 shrink-0 type-body-sm text-ink-muted">
                {formatLongDate(holiday.date)}
              </span>
              <span className="min-w-0 flex-1 truncate type-body text-ink">{holiday.name}</span>
              <IconButton
                label={`Remove ${holiday.name}`}
                size="sm"
                onClick={() => remove.mutate(holiday.id)}
              >
                <Trash2 aria-hidden />
              </IconButton>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
