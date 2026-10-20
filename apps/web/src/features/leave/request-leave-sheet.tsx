'use client';

import type { LeaveType } from '@lintel/api-contracts';
import {
  Button,
  DatePicker,
  Field,
  SegmentedControl,
  Select,
  Sheet,
  SkeletonText,
  Textarea,
  useToast,
} from '@lintel/design-system/web';
import type { DayPortion } from '@lintel/domain';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { LeaveImpactSummary } from './leave-impact';

interface RequestLeaveSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly types: readonly LeaveType[];
  readonly today: string;
}

const PORTIONS = [
  { value: 'full', label: 'Full day' },
  { value: 'first_half', label: 'Morning' },
  { value: 'second_half', label: 'Afternoon' },
] as const satisfies readonly { value: DayPortion; label: string }[];

/** Pick the days; the impact updates as you choose, before anything is sent. */
export function RequestLeaveSheet({ open, onOpenChange, types, today }: RequestLeaveSheetProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const active = types.filter((type) => type.isActive);
  const [typeId, setTypeId] = useState<string | undefined>(active[0]?.id);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [dayPortion, setDayPortion] = useState<DayPortion>('full');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const type = active.find((candidate) => candidate.id === typeId);
  const end = endDate ?? startDate;
  const singleDay = startDate !== null && end === startDate;
  const period =
    typeId && startDate && end && end >= startDate
      ? {
          leaveTypeId: typeId,
          startDate,
          endDate: end,
          dayPortion: singleDay ? dayPortion : ('full' as const),
        }
      : null;
  const deferredPeriod = useDeferredValue(period);
  const preview = useQuery({
    queryKey: ['leave', 'preview', deferredPeriod],
    queryFn: () =>
      expectStatus(
        api.leave.previewLeave({
          body: {
            ...(deferredPeriod ?? {
              leaveTypeId: '',
              startDate: today,
              endDate: today,
              dayPortion: 'full',
            }),
            userId: null,
            reason: null,
          },
        }),
        200,
      ),
    enabled: open && deferredPeriod !== null,
    placeholderData: keepPreviousData,
  });
  const submit = useMutation({
    mutationFn: () => {
      if (!period) throw new Error('Choose the days first.');
      return expectStatus(
        api.leave.requestLeave({
          body: { ...period, reason: reason.trim() || null, handovers: [] },
        }),
        201,
      );
    },
    onSuccess: (request) => {
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast({
        tone: 'success',
        title: 'Leave requested',
        description: `${request.durationLabel}. Your approver has been told.`,
      });
      setStartDate(null);
      setEndDate(null);
      setReason('');
      onOpenChange(false);
    },
    onError: (failure) => fail(failure, 'send the request'),
  });
  const send = () => {
    if (type?.requiresReason && reason.trim().length < 3) {
      setError(`${type.name} needs a short reason.`);
      return;
    }
    setError(null);
    submit.mutate();
  };
  const blocked = (preview.data?.blockingProblems.length ?? 0) > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title="Request leave"
      description="Choose the days. You’ll see what it affects before you send it."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!period || blocked || preview.isFetching}
            pending={submit.isPending}
            onClick={send}
          >
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type of leave" hint={type?.description ?? undefined}>
            <Select
              value={typeId}
              onValueChange={setTypeId}
              options={active.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            />
          </Field>
          <div className="hidden sm:block" />
          <Field label="First day" required>
            <DatePicker
              value={startDate}
              onValueChange={(value) => {
                setStartDate(value);
                if (value && endDate && endDate < value) setEndDate(null);
              }}
              min={today}
              today={today}
            />
          </Field>
          <Field label="Last day" hint="Leave empty for a single day.">
            <DatePicker
              value={endDate}
              onValueChange={setEndDate}
              min={startDate ?? today}
              today={today}
            />
          </Field>
        </div>
        {singleDay && type?.allowsHalfDay && (
          <SegmentedControl
            label="Which part of the day"
            value={dayPortion}
            onValueChange={setDayPortion}
            options={PORTIONS}
            size="sm"
            className="self-start"
          />
        )}
        <Field
          label="Reason"
          required={type?.requiresReason ?? false}
          hint={type?.requiresReason ? undefined : 'Optional.'}
          error={error}
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <section aria-live="polite" className="rounded-lg border border-hairline bg-surface p-4">
          {!period && (
            <p className="type-body-sm text-ink-faint">
              Choose the days to see how long it is and what it affects.
            </p>
          )}
          {period && preview.isPending && <SkeletonText lines={3} />}
          {period && preview.data && (
            <div
              className={
                preview.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'
              }
            >
              <LeaveImpactSummary impact={preview.data} today={today} />
            </div>
          )}
          {period && preview.isError && (
            <p className="type-body-sm text-overdue">
              The preview couldn’t be worked out. Check the dates and try again.
            </p>
          )}
        </section>
      </div>
    </Sheet>
  );
}
