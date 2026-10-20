'use client';

import {
  MotionPreferenceProvider,
  ToastProvider,
  TooltipProvider,
} from '@lintel/design-system/web';
import { QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import {
  applyMotionAttribute,
  applyThemeAttribute,
  MOTION_COOKIE,
  THEME_COOKIE,
  type ThemePreference,
  writePreferenceCookie,
} from './preferences';
import { createQueryClient } from './query-client';

interface DisplayPreferences {
  readonly theme: ThemePreference;
  readonly setTheme: (theme: ThemePreference) => void;
  readonly calmMotion: boolean;
  readonly setCalmMotion: (calm: boolean) => void;
}

const DisplayPreferencesContext = createContext<DisplayPreferences | null>(null);

export function useDisplayPreferences(): DisplayPreferences {
  const value = useContext(DisplayPreferencesContext);
  if (!value) throw new Error('useDisplayPreferences must be used inside AppProviders.');
  return value;
}

interface AppProvidersProps {
  readonly initialTheme: ThemePreference;
  readonly initialCalmMotion: boolean;
  readonly children: ReactNode;
}

export function AppProviders({ initialTheme, initialCalmMotion, children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  const [theme, setThemeState] = useState(initialTheme);
  const [calmMotion, setCalmState] = useState(initialCalmMotion);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    applyThemeAttribute(next);
    writePreferenceCookie(THEME_COOKIE, next);
  }, []);
  const setCalmMotion = useCallback((calm: boolean) => {
    setCalmState(calm);
    applyMotionAttribute(calm);
    writePreferenceCookie(MOTION_COOKIE, calm ? 'calm' : 'full');
  }, []);
  const preferences = useMemo(
    () => ({ theme, setTheme, calmMotion, setCalmMotion }),
    [theme, setTheme, calmMotion, setCalmMotion],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DisplayPreferencesContext.Provider value={preferences}>
        <MotionPreferenceProvider calm={calmMotion} onCalmChange={setCalmMotion}>
          <TooltipProvider>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </MotionPreferenceProvider>
      </DisplayPreferencesContext.Provider>
    </QueryClientProvider>
  );
}
