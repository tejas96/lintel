'use client';

import { Avatar, Button, SegmentedControl, Switch } from '@lintel/design-system/web';
import { ROLE_LABELS } from '@lintel/domain';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSession } from '@/features/session/session-provider';
import { useDisplayPreferences } from '@/providers/app-providers';
import type { ThemePreference } from '@/providers/preferences';
import { useSignOut } from './use-sign-out';

const THEME_OPTIONS = [
  { value: 'system', label: 'Auto', icon: <Monitor aria-hidden /> },
  { value: 'light', label: 'Light', icon: <Sun aria-hidden /> },
  { value: 'dark', label: 'Dark', icon: <Moon aria-hidden /> },
] as const satisfies readonly { value: ThemePreference; label: string; icon: ReactNode }[];

/** Who is signed in, display preferences and sign out. */
export function PreferencesPanel() {
  const { user } = useSession();
  const { theme, setTheme, calmMotion, setCalmMotion } = useDisplayPreferences();
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
        <SegmentedControl
          label="Colour theme"
          value={theme}
          onValueChange={setTheme}
          options={THEME_OPTIONS}
          size="sm"
          className="w-full [&>button]:flex-1"
        />
        <Switch
          label="Calm motion"
          description="Keep fades, skip movement and count-ups."
          checked={calmMotion}
          onCheckedChange={setCalmMotion}
        />
      </div>
      <div className="border-t border-hairline pt-3">
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
