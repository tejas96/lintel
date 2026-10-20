'use client';

import type { DirectoryEntry, Team } from '@lintel/api-contracts';
import { Avatar, Button, Sheet, StatusPill } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { useSession } from '@/features/session/session-provider';
import { isApiError } from '@/lib/api/api-error';
import { formatRelativeInstant } from '@/lib/format/dates';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { DeactivatePersonDialog } from './deactivate-person-dialog';
import { checkPerson, PersonFields, type PersonFormValues, valuesOf } from './person-fields';
import { usePersonAdmin } from './use-person-admin';

interface EditPersonSheetProps {
  /** The person as the directory has them now; null while the sheet slides away. */
  readonly person: DirectoryEntry | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly teams: readonly Team[];
  readonly onRefresh: () => void;
}

/** Change someone's role, team, manager or capacity, or switch their account off and on. */
export function EditPersonSheet({
  person,
  open,
  onOpenChange,
  teams,
  onRefresh,
}: EditPersonSheetProps) {
  return (
    <Sheet
      open={open && person !== null}
      onOpenChange={onOpenChange}
      width="lg"
      title={person?.fullName ?? ''}
      description={person ? (person.designation ?? ROLE_LABELS[person.role]) : undefined}
      header={
        person && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Avatar name={person.fullName} hue={person.avatarHue} size="sm" decorative />
            <StatusPill
              tone={person.status === 'deactivated' ? 'neutral' : 'onTrack'}
              glyph={person.status === 'deactivated' ? 'cancelled' : 'onTrack'}
              label={person.status === 'deactivated' ? 'Deactivated' : 'Active'}
              size="sm"
            />
            <span className="type-body-sm text-ink-faint">
              {person.maskedPhone}
              {person.lastActiveAt && `, last active ${formatRelativeInstant(person.lastActiveAt)}`}
            </span>
          </div>
        )
      }
    >
      {person && (
        <PersonEditor
          key={person.version}
          person={person}
          teams={teams}
          onRefresh={onRefresh}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  );
}

function PersonEditor({
  person,
  teams,
  onRefresh,
  onDone,
}: {
  readonly person: DirectoryEntry;
  readonly teams: readonly Team[];
  readonly onRefresh: () => void;
  readonly onDone: () => void;
}) {
  const { user } = useSession();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const admin = usePersonAdmin(person);
  const [values, setValues] = useState<PersonFormValues>(() => valuesOf(person));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [deactivating, setDeactivating] = useState(false);
  const isOwner = person.role === 'owner';
  const canChange = !isOwner || user.role === 'owner';
  const onError = (action: string) => (error: unknown) => {
    if (staleness.catchStale(error)) return;
    if (isApiError(error)) setErrors(error.fieldErrors());
    fail(error, action);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = checkPerson(values, false);
    setErrors(found);
    if (Object.keys(found).length === 0)
      admin.save.mutate(values, { onSuccess: onDone, onError: onError('save the changes') });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8 p-5 sm:p-6">
      <StaleVersionNotice
        show={staleness.stale}
        message="Someone else changed this person while you were editing. Refresh to load their latest details, then make your change again."
        onRefresh={() => {
          staleness.clear();
          onRefresh();
        }}
      />
      {!canChange && (
        <p className="rounded-md border border-hairline bg-surface p-3 type-body-sm text-ink-muted">
          Only the owner can change the owner’s account.
        </p>
      )}
      <fieldset disabled={!canChange} className="contents">
        <PersonFields
          values={values}
          onChange={setValues}
          errors={errors}
          teams={teams}
          mode="edit"
          personId={person.id}
          isOwner={isOwner}
        />
      </fieldset>
      {canChange && (
        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            variant="primary"
            pending={admin.save.isPending}
            disabled={!admin.hasChanges(values) || staleness.stale}
          >
            Save changes
          </Button>
        </div>
      )}
      {!isOwner && person.id !== user.id && (
        <section className="flex flex-col gap-3 border-t border-hairline pt-6">
          <h3 className="type-title-md text-ink">Account</h3>
          {person.status === 'deactivated' ? (
            <>
              <p className="type-body-sm text-ink-muted">
                This account is switched off. Reactivating lets them sign in again with their phone.
              </p>
              <Button
                className="self-start"
                pending={admin.reactivate.isPending}
                onClick={() =>
                  admin.reactivate.mutate(undefined, {
                    onSuccess: onDone,
                    onError: onError('reactivate the account'),
                  })
                }
              >
                Reactivate account
              </Button>
            </>
          ) : (
            <>
              <p className="type-body-sm text-ink-muted">
                Someone leaving the studio? Deactivating signs them out everywhere and keeps their
                history.
              </p>
              <Button variant="danger" className="self-start" onClick={() => setDeactivating(true)}>
                Deactivate account
              </Button>
            </>
          )}
        </section>
      )}
      <DeactivatePersonDialog
        open={deactivating}
        onOpenChange={setDeactivating}
        name={person.fullName}
        pending={admin.deactivate.isPending}
        onConfirm={(reason) =>
          admin.deactivate.mutate(reason, {
            onSuccess: () => {
              setDeactivating(false);
              onDone();
            },
            onError: (error) => {
              setDeactivating(false);
              onError('deactivate the account')(error);
            },
          })
        }
      />
    </form>
  );
}
