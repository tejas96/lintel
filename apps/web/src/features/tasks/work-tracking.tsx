'use client';

import type { TransitionOption } from '@lintel/api-contracts';
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

/**
 * The move to "in progress", when starting work can make it in one step:
 * the server allows it and it needs no note. Starting work then replaces the
 * plain status button, so the person never sees two "Start" buttons, and a
 * start the server would refuse is never offered.
 */
export function startMove(
  status: TaskStatus,
  transitions: readonly TransitionOption[],
): TransitionOption | null {
  if (!canStartFrom(status)) return null;
  const move = transitions.find((option) => option.to === 'in_progress');
  return move?.allowed && !move.requiresNote ? move : null;
}
