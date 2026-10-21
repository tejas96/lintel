'use client';

import type { NotificationPreferences } from '@lintel/api-contracts';
import { SegmentedControl } from '@lintel/design-system/web';

interface EmailSettingsProps {
  readonly delivery: NotificationPreferences['delivery'];
  readonly emailDigest: NotificationPreferences['emailDigest'];
  readonly onEmailDigestChange: (next: NotificationPreferences['emailDigest']) => void;
}

/** How chosen emails arrive: one by one, or collected into one email a day. */
export function EmailSettings({ delivery, emailDigest, onEmailDigestChange }: EmailSettingsProps) {
  const time = delivery.emailDigestTime;
  return (
    <section
      aria-labelledby="email-settings-title"
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-5"
    >
      <div className="flex flex-col gap-1">
        <h3 id="email-settings-title" className="type-title-md text-ink">
          Email
        </h3>
        <p className="type-body-sm text-ink-muted">
          {delivery.hasEmailAddress
            ? `Tick Email above for what should reach your inbox. A daily digest collects them into one email at ${time}; urgent alerts still arrive straight away.`
            : 'There’s no email address on your profile yet. Ask a studio administrator to add one, then choose what reaches your inbox.'}
        </p>
      </div>
      {delivery.hasEmailAddress && (
        <SegmentedControl
          label="How emails arrive"
          value={emailDigest}
          onValueChange={onEmailDigestChange}
          options={[
            { value: 'off', label: 'As they happen' },
            { value: 'daily', label: `One digest at ${time}` },
          ]}
          size="sm"
          className="self-start"
        />
      )}
    </section>
  );
}
