'use client';

import type { NotificationPreferences } from '@lintel/api-contracts';
import { Checkbox } from '@lintel/design-system/web';
import { NOTIFICATION_URGENCY, type NotificationKind } from '@lintel/domain';
import { Fragment } from 'react';
import { KIND_COPY, KIND_GROUPS } from './notification-kinds';
import { isEnabled, withChannel } from './use-notification-preferences';

interface NotificationMatrixProps {
  readonly preferences: NotificationPreferences;
  readonly onChange: (preferences: NotificationPreferences) => void;
}

const ALL_COLUMNS = [
  { channel: 'in_app', label: 'In Lintel', hint: 'Always kept', spoken: 'in Lintel' },
  { channel: 'push', label: 'Push', hint: 'Phone and browser', spoken: 'push' },
  { channel: 'sms', label: 'SMS', hint: 'Urgent only', spoken: 'SMS' },
  { channel: 'email', label: 'Email', hint: 'To your inbox', spoken: 'email' },
] as const;

type Column = (typeof ALL_COLUMNS)[number];

/** SMS and email appear only when the studio has switched them on. */
function columnsFor(preferences: NotificationPreferences): readonly Column[] {
  return ALL_COLUMNS.filter(
    (column) =>
      (column.channel !== 'sms' || preferences.delivery.sms) &&
      (column.channel !== 'email' || preferences.delivery.email),
  );
}

function Unavailable({ reason }: { readonly reason: string }) {
  return (
    <span className="text-ink-faint" title={reason}>
      –<span className="sr-only">{reason}</span>
    </span>
  );
}

/**
 * Each kind of notification against each way it can reach you. The inbox
 * always keeps everything; SMS is only ever used for urgent alerts; email
 * needs an address on file.
 */
export function NotificationMatrix({ preferences, onChange }: NotificationMatrixProps) {
  const columns = columnsFor(preferences);
  // Only kinds this person's role and projects can ever receive (decided by the server).
  const receivable = new Set(preferences.receivableKinds);
  const groups = KIND_GROUPS.map((group) => ({
    ...group,
    kinds: group.kinds.filter((kind) => receivable.has(kind)),
  })).filter((group) => group.kinds.length > 0);
  const cell = (kind: NotificationKind, column: Column) => {
    const { channel } = column;
    const label = `${KIND_COPY[kind].label}: ${column.spoken}`;
    if (channel === 'in_app') {
      return (
        <Checkbox
          label={`${label}, always on`}
          hideLabel
          checked
          disabled
          onCheckedChange={() => undefined}
          className="min-h-0 items-center justify-center py-0 [&>button]:mt-0"
        />
      );
    }
    if (channel === 'sms' && NOTIFICATION_URGENCY[kind] !== 'urgent') {
      return <Unavailable reason="Only urgent alerts are sent by SMS" />;
    }
    if (channel === 'email' && !preferences.delivery.hasEmailAddress) {
      return <Unavailable reason="No email address on file" />;
    }
    return (
      <Checkbox
        label={label}
        hideLabel
        checked={isEnabled(preferences, kind, channel)}
        onCheckedChange={(enabled) => onChange(withChannel(preferences, kind, channel, enabled))}
        className="min-h-0 items-center justify-center py-0 [&>button]:mt-0"
      />
    );
  };
  return (
    <div className="relative overflow-x-auto rounded-lg border border-hairline bg-raised">
      <table
        className={
          columns.length > 3
            ? 'w-full min-w-[20rem] border-separate border-spacing-0'
            : 'w-full min-w-[22rem] border-separate border-spacing-0'
        }
      >
        <caption className="sr-only">How each kind of notification reaches you</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-hairline px-4 py-3 text-left type-label font-medium text-ink-faint"
            >
              Notification
            </th>
            {columns.map((column) => (
              <th
                key={column.channel}
                scope="col"
                className={
                  columns.length > 3
                    ? 'w-12 border-b border-hairline px-0.5 py-3 text-center sm:w-28'
                    : 'w-16 border-b border-hairline px-1 py-3 text-center sm:w-28'
                }
              >
                <span className="block type-label font-medium text-ink-muted">{column.label}</span>
                <span className="hidden text-[0.6875rem] font-normal text-ink-faint sm:block">
                  {column.hint}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.title}>
              <tr>
                <th
                  colSpan={columns.length + 1}
                  scope="colgroup"
                  className="border-b border-hairline bg-surface px-4 pt-4 pb-2 text-left type-title-md font-semibold text-ink"
                >
                  {group.title}
                </th>
              </tr>
              {group.kinds.map((kind) => (
                <tr key={kind} className="group">
                  <th
                    scope="row"
                    className="border-b border-hairline px-4 py-2.5 text-left font-normal group-last:border-b-0"
                  >
                    <span className="block type-body-sm font-medium text-ink">
                      {KIND_COPY[kind].label}
                    </span>
                    <span className="block type-body-sm text-ink-faint">
                      {KIND_COPY[kind].explanation}
                    </span>
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column.channel}
                      className="border-b border-hairline px-1 text-center align-middle"
                    >
                      <span className="inline-flex justify-center">{cell(kind, column)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
