import type { LeaveRequestDetail, LeaveType } from '@lintel/api-contracts';
import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@/components/search-field';
import { type LeavePeriodInput, useLeavePreview, useRequestLeave } from '@/queries/leave-queries';
import type { DateRange } from './date-range-calendar';
import type { HandoverDraft } from './handover-proposals';

type DayPortion = LeaveRequestDetail['dayPortion'];

/** Form state for a new leave request plus the live server preview of its impact. */
export function useLeaveForm(types: readonly LeaveType[]) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  const [dayPortion, setDayPortion] = useState<DayPortion>('full');
  const [reason, setReason] = useState('');
  const [handovers, setHandovers] = useState<Readonly<Record<string, HandoverDraft>>>({});
  const type = types.find((candidate) => candidate.id === typeId) ?? null;
  const singleDay = range !== null && range.start === range.end;
  const effectivePortion: DayPortion = singleDay && type?.allowsHalfDay ? dayPortion : 'full';
  const debouncedReason = useDebouncedValue(reason.trim(), 600);

  const period = useMemo<LeavePeriodInput | null>(
    () =>
      type && range
        ? {
            leaveTypeId: type.id,
            startDate: range.start,
            endDate: range.end,
            dayPortion: effectivePortion,
            reason: debouncedReason || null,
          }
        : null,
    [type, range, effectivePortion, debouncedReason],
  );
  const previewPeriod = useDebouncedValue(period, 350);
  const preview = useLeavePreview(previewPeriod);
  const request = useRequestLeave();

  const reasonMissing = Boolean(type?.requiresReason) && reason.trim().length < 3;
  const blocked = (preview.data?.blockingProblems.length ?? 0) > 0;
  // Submit only against a preview of exactly what is on screen.
  const previewCurrent =
    previewPeriod === period &&
    preview.isSuccess &&
    !preview.isPlaceholderData &&
    !preview.isFetching;
  const canSubmit = period !== null && previewCurrent && !reasonMissing && !blocked;

  const submit = (
    onDone: (created: LeaveRequestDetail) => void,
    onError: (error: unknown) => void,
  ) => {
    if (!period || !canSubmit) return;
    request.mutate(
      {
        ...period,
        reason: reason.trim() || null,
        handovers: Object.entries(handovers).flatMap(([taskId, draft]) =>
          draft.to ? [{ taskId, toUserId: draft.to.id, note: draft.note.trim() || null }] : [],
        ),
      },
      { onSuccess: onDone, onError },
    );
  };

  return {
    type,
    typeId,
    setTypeId,
    range,
    setRange,
    singleDay,
    dayPortion: effectivePortion,
    setDayPortion,
    reason,
    setReason,
    reasonMissing,
    handovers,
    setHandover: (taskId: string, draft: HandoverDraft) =>
      setHandovers((current) => ({ ...current, [taskId]: draft })),
    preview,
    previewPending: period !== null && (previewPeriod !== period || preview.isFetching),
    request,
    canSubmit,
    submit,
  };
}
