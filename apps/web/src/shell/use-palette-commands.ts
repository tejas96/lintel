'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BellRing,
  DraftingCompass,
  LogOut,
  type LucideIcon,
  Monitor,
  Moon,
  Plus,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { useDisplayPreferences } from '@/providers/app-providers';
import { visibleNavItems } from './navigation';
import { useSignOut } from './use-sign-out';

export interface PaletteCommand {
  readonly id: string;
  readonly group: 'Projects' | 'Go to' | 'Create' | 'Preferences';
  readonly label: string;
  readonly hint?: string;
  readonly icon: LucideIcon;
  readonly keywords?: string;
  readonly run: () => void;
}

function matches(command: PaletteCommand, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${command.label} ${command.keywords ?? ''} ${command.hint ?? ''}`
    .toLowerCase()
    .includes(needle);
}

/** Navigation, creation and preference commands, plus matching projects from the server. */
export function usePaletteCommands(query: string, open: boolean): PaletteCommand[] {
  const router = useRouter();
  const { can } = useSession();
  const { theme, setTheme, calmMotion, setCalmMotion } = useDisplayPreferences();
  const signOut = useSignOut();
  const search = useDeferredValue(query.trim());

  const projects = useQuery({
    queryKey: ['palette', 'projects', search],
    queryFn: () =>
      expectStatus(
        api.projects.listProjects({ query: { search, pageSize: 6, page: 1, status: 'open' } }),
        200,
      ),
    enabled: open && search.length >= 2,
    retry: false,
    staleTime: 60_000,
  });

  return useMemo(() => {
    const projectCommands: PaletteCommand[] = (projects.data?.items ?? []).map((project) => ({
      id: `project-${project.id}`,
      group: 'Projects',
      label: project.name,
      hint: project.reference,
      icon: DraftingCompass,
      run: () => router.push(`/projects/${project.id}`),
    }));
    const navigation: PaletteCommand[] = visibleNavItems(can).map((item) => ({
      id: `nav-${item.id}`,
      group: 'Go to',
      label: item.label,
      icon: item.icon,
      run: () => router.push(item.href),
    }));
    const create: PaletteCommand[] = can('projects.create')
      ? [
          {
            id: 'new-project',
            group: 'Create',
            label: 'New project',
            icon: Plus,
            keywords: 'create add',
            run: () => router.push('/projects/new'),
          },
        ]
      : [];
    const preferences: PaletteCommand[] = [
      {
        id: 'account',
        label: 'Your account',
        icon: BellRing,
        keywords: 'profile notifications devices sessions quiet hours',
        run: () => router.push('/account'),
      },
      ...(theme !== 'dark'
        ? [{ id: 'theme-dark', label: 'Use dark theme', icon: Moon, run: () => setTheme('dark') }]
        : []),
      ...(theme !== 'light'
        ? [{ id: 'theme-light', label: 'Use light theme', icon: Sun, run: () => setTheme('light') }]
        : []),
      ...(theme !== 'system'
        ? [
            {
              id: 'theme-system',
              label: 'Match device theme',
              icon: Monitor,
              run: () => setTheme('system'),
            },
          ]
        : []),
      {
        id: 'calm',
        label: calmMotion ? 'Turn calm motion off' : 'Turn calm motion on',
        icon: Sparkles,
        keywords: 'animation reduce',
        run: () => setCalmMotion(!calmMotion),
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        icon: LogOut,
        keywords: 'log out',
        run: () => signOut.mutate(),
      },
    ].map((command) => ({ ...command, group: 'Preferences' as const }));
    return [...projectCommands, ...navigation, ...create, ...preferences].filter(
      (command) => command.group === 'Projects' || matches(command, query),
    );
  }, [projects.data, can, theme, calmMotion, setTheme, setCalmMotion, signOut, router, query]);
}
