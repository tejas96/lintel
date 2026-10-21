import type { NotificationKind } from '@lintel/domain';

interface KindCopy {
  readonly label: string;
  readonly explanation: string;
}

/** Every notification in plain words: what it is and when it arrives. */
export const KIND_COPY: Readonly<Record<NotificationKind, KindCopy>> = {
  task_assigned: {
    label: 'A task is given to you',
    explanation: 'When someone assigns you a task.',
  },
  task_reassigned: {
    label: 'A task moves to or from you',
    explanation: 'When a task is reassigned.',
  },
  deadline_upcoming: {
    label: 'A deadline is near',
    explanation: 'The working day before your task is due.',
  },
  task_overdue: { label: 'Your task is overdue', explanation: 'At the end of the day it was due.' },
  task_overdue_escalated: {
    label: 'Overdue work needs a manager',
    explanation: 'When someone’s task stays overdue and you manage it.',
  },
  priority_changed: {
    label: 'Your next priority changes',
    explanation: 'When new work jumps to the top of your day.',
  },
  task_blocked: {
    label: 'Work is blocked',
    explanation: 'When a task you own or manage can’t move.',
  },
  blocker_resolved: { label: 'A blocker is cleared', explanation: 'When the work can move again.' },
  review_requested: {
    label: 'Work waits for your review',
    explanation: 'When a task or deliverable is sent to you.',
  },
  review_reminder: {
    label: 'A review is still waiting',
    explanation: 'A reminder when a review sits for too long.',
  },
  review_decided: {
    label: 'Your work was reviewed',
    explanation: 'Approved, or changes asked for.',
  },
  leave_requested: {
    label: 'Someone asks for leave',
    explanation: 'When a request needs your decision.',
  },
  leave_decided: { label: 'Your leave is decided', explanation: 'Approved or not, with the note.' },
  leave_info_requested: {
    label: 'Your approver has a question',
    explanation: 'About a leave request you made.',
  },
  handover_requested: {
    label: 'You’re asked to cover a task',
    explanation: 'While a colleague is away.',
  },
  absence_reassessment: {
    label: 'Someone is unexpectedly away',
    explanation: 'Their work needs looking at today.',
  },
  project_at_risk: {
    label: 'A project falls behind',
    explanation: 'When a project you’re on is at risk or off track.',
  },
  scope_change_requested: {
    label: 'A scope change is proposed',
    explanation: 'With its effect on dates.',
  },
  scope_change_decided: {
    label: 'A scope change is decided',
    explanation: 'Approved or rejected.',
  },
  reward_updated: {
    label: 'Your reward is updated',
    explanation: 'When your recognition is reviewed.',
  },
  reassignment_requested: {
    label: 'Someone asks to hand over a task',
    explanation: 'When a task in a project you manage should move to someone else.',
  },
  reassignment_decided: {
    label: 'Your handover request is decided',
    explanation: 'Accepted with the new owner, or declined with a note.',
  },
  task_late_start: {
    label: 'Your task has not started',
    explanation: 'The working day after its planned start, if it is still waiting.',
  },
  date_change_requested: {
    label: 'Someone asks for a new date',
    explanation: 'When a task in a project you manage needs a later date.',
  },
  date_change_decided: {
    label: 'Your new-date request is decided',
    explanation: 'Accepted with the new dates, or declined with a note.',
  },
};

/** Kinds in the order people think about them. */
export const KIND_GROUPS: readonly {
  readonly title: string;
  readonly kinds: readonly NotificationKind[];
}[] = [
  {
    title: 'Your work',
    kinds: [
      'task_assigned',
      'task_reassigned',
      'deadline_upcoming',
      'task_overdue',
      'task_late_start',
      'priority_changed',
      'reassignment_decided',
      'date_change_decided',
    ],
  },
  {
    title: 'Blockers and reviews',
    kinds: [
      'task_blocked',
      'blocker_resolved',
      'review_requested',
      'review_reminder',
      'review_decided',
      'reassignment_requested',
      'date_change_requested',
    ],
  },
  {
    title: 'Leave and cover',
    kinds: [
      'leave_requested',
      'leave_decided',
      'leave_info_requested',
      'handover_requested',
      'absence_reassessment',
    ],
  },
  {
    title: 'Projects and recognition',
    kinds: [
      'project_at_risk',
      'task_overdue_escalated',
      'scope_change_requested',
      'scope_change_decided',
      'reward_updated',
    ],
  },
];
