'use client';

import { SegmentedControl, Switch } from '@lintel/design-system/web';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDisplayPreferences } from '@/providers/app-providers';
import type { ThemePreference } from '@/providers/preferences';

const THEME_OPTIONS = [
  { value: 'system', label: 'Auto', icon: <Monitor aria-hidden /> },
  { value: 'light', label: 'Light', icon: <Sun aria-hidden /> },
  { value: 'dark', label: 'Dark', icon: <Moon aria-hidden /> },
] as const satisfies readonly { value: ThemePreference; label: string; icon: ReactNode }[];

/** Colour theme and Calm motion; both apply at once and are remembered on this device. */
export function AppearanceControls({ size = 'sm' }: { readonly size?: 'sm' | 'md' }) {
  const { theme, setTheme, calmMotion, setCalmMotion } = useDisplayPreferences();
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label="Colour theme"
        value={theme}
        onValueChange={setTheme}
        options={THEME_OPTIONS}
        size={size}
        className="w-full [&>button]:flex-1"
      />
      <Switch
        label="Calm motion"
        description="Keep fades, skip movement and count-ups."
        checked={calmMotion}
        onCheckedChange={setCalmMotion}
      />
    </div>
  );
}
