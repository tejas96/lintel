'use client';

import { Avatar, Button } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { BellRing, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useSession } from '@/features/session/session-provider';
import { AppearanceControls } from './appearance-controls';
import { useSignOut } from './use-sign-out';

/** Who is signed in, display preferences, the account page and sign out. */
export function PreferencesPanel({ onNavigate }: { readonly onNavigate?: () => void }) {
  const { user } = useSession();
  const signOut = useSignOut();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.fullName} hue={user.avatarHue} size="md" decorative />
        <div className="flex min-w-0 flex-col">
          <p className="truncate type-title-md text-ink">{user.fullName}</p>
          <p className="truncate type-body-sm text-ink-faint">
            {user.designation ?? ROLE_LABELS[user.role]}, {user.organizationName}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        <p className="type-label text-ink-muted">Appearance</p>
        <AppearanceControls />
      </div>
      <div className="flex flex-col gap-1 border-t border-hairline pt-3">
        <Button asChild variant="quiet" size="sm" className="w-full justify-start">
          <Link href="/account" {...(onNavigate ? { onClick: onNavigate } : {})}>
            <BellRing aria-hidden className="size-4" />
            Account, notifications and devices
          </Link>
        </Button>
        <Button
          variant="quiet"
          size="sm"
          pending={signOut.isPending}
          onClick={() => signOut.mutate()}
          leadingIcon={<LogOut aria-hidden />}
          className="w-full justify-start"
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
