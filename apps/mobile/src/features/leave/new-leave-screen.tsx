import { calendarDateInTimeZone } from '@lintel/shared';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { errorMessage, fieldErrors } from '@/api/api-error';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChoiceChips } from '@/components/choice-chips';
import { ScreenScroll } from '@/components/screen';
import { Section } from '@/components/section';
import { SegmentedControl } from '@/components/segmented-control';
import { SkeletonList } from '@/components/skeleton';
import { ErrorState, InlineError } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { useToast } from '@/feedback/toast';
import { formatDateRange } from '@/formatting/dates';
import { useLeaveTypes } from '@/queries/leave-queries';
import { useCurrentUser } from '@/session/session-provider';
import { SPACE } from '@/theme/layout';
import { DateRangeCalendar } from './date-range-calendar';
import { HandoverProposals } from './handover-proposals';
import { LeaveImpactPreview } from './leave-impact-preview';
import { useLeaveForm } from './use-leave-form';

/** Choose a type and dates; the server's impact preview updates as you go. */
export function NewLeaveScreen() {
  const user = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const types = useLeaveTypes();
  const active = (types.data ?? []).filter((type) => type.isActive);
  const form = useLeaveForm(active);
  const today = calendarDateInTimeZone(new Date(), user.timeZone);
  const errors = fieldErrors(form.request.error);

  if (types.isPending)
    return (
      <ScreenScroll edge="stack">
        <SkeletonList count={3} />
      </ScreenScroll>
    );
  if (types.isError) {
    return (
      <ScreenScroll edge="stack">
        <ErrorState
          error={types.error}
          subject="leave types"
          onRetry={() => void types.refetch()}
        />
      </ScreenScroll>
    );
  }

  const submit = () =>
    form.submit(
      (created) => {
        toast.show('Leave requested. You’ll be notified when it’s decided.', 'success');
        router.replace({ pathname: '/leave/[id]', params: { id: created.id } });
      },
      (error) => {
        if (Object.keys(fieldErrors(error)).length === 0) toast.show(errorMessage(error), 'error');
      },
    );

  return (
    <ScreenScroll edge="stack">
      <Section title="Type of leave">
        <ChoiceChips
          options={active.map((type) => ({ value: type.id, label: type.name }))}
          value={form.typeId}
          onChange={form.setTypeId}
          accessibilityLabel="Type of leave"
        />
        {form.type?.description ? (
          <AppText variant="bodySm" tone="secondary">
            {form.type.description}
            {form.type.minimumNoticeDays > 0
              ? ` Give ${form.type.minimumNoticeDays} days’ notice.`
              : ''}
          </AppText>
        ) : null}
      </Section>
      <Section
        title="Dates"
        meta={form.range ? formatDateRange(form.range.start, form.range.end) : undefined}
      >
        <Card>
          <DateRangeCalendar today={today} value={form.range} onChange={form.setRange} />
        </Card>
        {form.singleDay && form.type?.allowsHalfDay ? (
          <SegmentedControl
            accessibilityLabel="Part of the day"
            value={form.dayPortion}
            onChange={form.setDayPortion}
            options={[
              { value: 'full', label: 'Full day' },
              { value: 'first_half', label: 'Morning' },
              { value: 'second_half', label: 'Afternoon' },
            ]}
          />
        ) : null}
      </Section>
      <TextField
        label={form.type?.requiresReason ? 'Reason (required)' : 'Reason (optional)'}
        value={form.reason}
        onChangeText={form.setReason}
        multiline
        maxLength={1000}
        error={errors.reason ?? null}
      />
      {form.preview.data ? (
        <LeaveImpactPreview impact={form.preview.data} updating={form.previewPending} />
      ) : form.previewPending ? (
        <SkeletonList count={1} label="Checking the impact" />
      ) : null}
      {form.preview.isError ? (
        <InlineError error={form.preview.error} onRetry={() => void form.preview.refetch()} />
      ) : null}
      {form.preview.data ? (
        <HandoverProposals
          conflicts={form.preview.data.conflicts}
          drafts={form.handovers}
          onChange={form.setHandover}
          selfUserId={user.id}
        />
      ) : null}
      <View style={{ gap: SPACE.sm }}>
        <Button
          label="Send request"
          size="lg"
          onPress={submit}
          loading={form.request.isPending}
          disabled={!form.canSubmit}
        />
        {!form.type || !form.range ? (
          <AppText variant="bodySm" tone="tertiary" align="center">
            Choose a type and your dates to see the impact.
          </AppText>
        ) : null}
      </View>
    </ScreenScroll>
  );
}
