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

const COLUMNS = [
  { channel: 'in_app', label: 'In Lintel', hint: 'Always kept' },
  { channel: 'push', label: 'Push', hint: 'To your phone' },
  { channel: 'sms', label: 'SMS', hint: 'Urgent only' },
] as const;

/**
 * Each kind of notification against each way it can reach you. The inbox
 * always keeps everything; SMS is only ever used for urgent alerts.
 */
export function NotificationMatrix({ preferences, onChange }: NotificationMatrixProps) {
  const cell = (kind: NotificationKind, channel: (typeof COLUMNS)[number]['channel']) => {
    const label = `${KIND_COPY[kind].label}: ${channel === 'in_app' ? 'in Lintel' : channel === 'push' ? 'push' : 'SMS'}`;
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
      return (
        <span className="text-ink-faint" title="Only urgent alerts are sent by SMS">
          –<span className="sr-only">Not sent by SMS</span>
        </span>
      );
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
    <div className="overflow-x-auto rounded-lg border border-hairline bg-raised">
      <table className="w-full min-w-[22rem] border-separate border-spacing-0">
        <caption className="sr-only">How each kind of notification reaches you</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-hairline px-4 py-3 text-left type-label font-medium text-ink-faint"
            >
              Notification
            </th>
            {COLUMNS.map((column) => (
              <th
                key={column.channel}
                scope="col"
                className="w-16 border-b border-hairline px-1 py-3 text-center sm:w-28"
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
          {KIND_GROUPS.map((group) => (
            <Fragment key={group.title}>
              <tr>
                <th
                  colSpan={4}
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
                  {COLUMNS.map((column) => (
                    <td
                      key={column.channel}
                      className="border-b border-hairline px-1 text-center align-middle"
                    >
                      <span className="inline-flex justify-center">
                        {cell(kind, column.channel)}
                      </span>
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
