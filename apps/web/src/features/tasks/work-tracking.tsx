'use client';

import type { TaskStatus } from '@lintel/domain';
import { createContext, type ReactNode, useContext } from 'react';

const WorkTrackingContext = createContext(true);

/**
 * Whether the studio tracks working time, as the API last said (the work
 * queue and task detail carry it). Lists below this provider read it.
 */
export function WorkTrackingProvider({
  enabled,
  children,
}: {
  readonly enabled: boolean;
  readonly children: ReactNode;
}) {
  return <WorkTrackingContext.Provider value={enabled}>{children}</WorkTrackingContext.Provider>;
}

export function useWorkTracking(): boolean {
  return useContext(WorkTrackingContext);
}

/** Statuses from which "Start" moves a task to in progress. */
export function canStartFrom(status: TaskStatus): boolean {
  return status === 'ready' || status === 'changes_requested';
}
