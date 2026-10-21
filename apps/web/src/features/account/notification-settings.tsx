'use client';

import type { NotificationPreferences } from '@lintel/api-contracts';
import {
  Button,
  ErrorState,
  Field,
  Input,
  SegmentedControl,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import { useState } from 'react';
import { WebPushSettings } from '@/features/push/web-push-settings';
import { describeError } from '@/lib/api/describe-error';
import { EmailSettings } from './email-settings';
import { NotificationMatrix } from './notification-matrix';
import { useNotificationPreferences, useSavePreferences } from './use-notification-preferences';

/** How notifications reach this person, and when push stays quiet. */
export function NotificationSettings() {
  const loaded = useNotificationPreferences();
  if (loaded.isPending) {
    return (
      <SkeletonGroup label="Loading notification settings">
        <SkeletonText lines={6} />
      </SkeletonGroup>
    );
  }
  if (loaded.isError) {
    return (
      <ErrorState
        size="section"
        {...describeError(loaded.error, { resource: 'collection' })}
        onRetry={() => loaded.refetch()}
      />
    );
  }
  return <PreferencesForm key={JSON.stringify(loaded.data)} saved={loaded.data} />;
}

function PreferencesForm({ saved }: { readonly saved: NotificationPreferences }) {
  const save = useSavePreferences();
  const [preferences, setPreferences] = useState(saved);
  const [own, setOwn] = useState(saved.quietHours !== null);
  const [start, setStart] = useState(saved.quietHours?.start ?? '21:00');
  const [end, setEnd] = useState(saved.quietHours?.end ?? '08:00');
  const [emailDigest, setEmailDigest] = useState(saved.emailDigest);
  const quietHours = own ? { start, end } : null;
  const next = { ...preferences, quietHours, emailDigest };
  const dirty = JSON.stringify(next) !== JSON.stringify(saved);
  const sameTimes = own && start === end;

  return (
    <div className="flex flex-col gap-6">
      <WebPushSettings />
      <NotificationMatrix preferences={preferences} onChange={setPreferences} />
      {saved.delivery.email && (
        <EmailSettings
          delivery={saved.delivery}
          emailDigest={emailDigest}
          onEmailDigestChange={setEmailDigest}
        />
      )}
      <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-5">
        <div className="flex flex-col gap-1">
          <h3 className="type-title-md text-ink">Quiet hours</h3>
          <p className="type-body-sm text-ink-muted">
            Push notifications wait until quiet hours end. Urgent alerts still come through, and the
            inbox keeps everything.
          </p>
        </div>
        <SegmentedControl
          label="Quiet hours"
          value={own ? 'own' : 'studio'}
          onValueChange={(value) => setOwn(value === 'own')}
          options={[
            { value: 'studio', label: 'The studio’s hours' },
            { value: 'own', label: 'My own hours' },
          ]}
          size="sm"
          className="self-start"
        />
        {own && (
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <Field label="Quiet from" error={sameTimes ? 'Choose a different time.' : null}>
              <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label="Until">
              <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
            </Field>
          </div>
        )}
      </section>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {dirty && <span className="type-body-sm text-at-risk">Unsaved changes</span>}
        <Button
          variant="primary"
          disabled={!dirty || sameTimes}
          pending={save.isPending}
          onClick={() => save.mutate(next)}
        >
          Save notification settings
        </Button>
      </div>
    </div>
  );
}
