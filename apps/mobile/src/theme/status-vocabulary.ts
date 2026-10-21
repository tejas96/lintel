import type {
  ChallengeEntry,
  DeliverableSummary,
  LeaveRequest,
  Milestone,
  MilestoneRewardShare,
  ProjectHealthView,
  RewardEvaluation,
  TaskSummary,
} from '@lintel/api-contracts';
import type { StatusTone } from '@lintel/design-system/tokens';
import { TASK_STATUS_LABELS } from '@lintel/domain';
import type { IconName } from '@/components/icon';

/** Every status is a colour, a glyph and a word — never colour alone. */
export interface StatusPresentation {
  readonly tone: StatusTone | 'neutral';
  readonly icon: IconName;
  readonly label: string;
}

type TaskStatus = TaskSummary['status'];

const TASK_STATUS: Readonly<Record<TaskStatus, Omit<StatusPresentation, 'label'>>> = {
  draft: { tone: 'neutral', icon: 'document' },
  ready: { tone: 'neutral', icon: 'checkboxOff' },
  in_progress: { tone: 'onTrack', icon: 'play' },
  blocked: { tone: 'blocked', icon: 'blocked' },
  in_review: { tone: 'review', icon: 'review' },
  changes_requested: { tone: 'atRisk', icon: 'refresh' },
  done: { tone: 'done', icon: 'done' },
  cancelled: { tone: 'neutral', icon: 'close' },
};

export function taskStatusPresentation(status: TaskStatus): StatusPresentation {
  return { ...TASK_STATUS[status], label: TASK_STATUS_LABELS[status] };
}

export const OVERDUE_PRESENTATION: StatusPresentation = {
  tone: 'overdue',
  icon: 'waiting',
  label: 'Overdue',
};

const PROJECT_HEALTH: Readonly<Record<ProjectHealthView['status'], StatusPresentation>> = {
  not_started: { tone: 'neutral', icon: 'pending', label: 'Not started' },
  on_track: { tone: 'onTrack', icon: 'flag', label: 'On track' },
  at_risk: { tone: 'atRisk', icon: 'error', label: 'At risk' },
  off_track: { tone: 'overdue', icon: 'error', label: 'Off track' },
  closed: { tone: 'done', icon: 'done', label: 'Closed' },
};

export function projectHealthPresentation(status: ProjectHealthView['status']): StatusPresentation {
  return PROJECT_HEALTH[status];
}

const MILESTONE_HEALTH: Readonly<Record<Milestone['health'], StatusPresentation>> = {
  completed: { tone: 'done', icon: 'done', label: 'Completed' },
  on_track: { tone: 'onTrack', icon: 'flag', label: 'On track' },
  at_risk: { tone: 'atRisk', icon: 'error', label: 'At risk' },
  missed: { tone: 'overdue', icon: 'waiting', label: 'Missed' },
};

export function milestoneHealthPresentation(health: Milestone['health']): StatusPresentation {
  return MILESTONE_HEALTH[health];
}

const LEAVE_STATUS: Readonly<Record<LeaveRequest['status'], StatusPresentation>> = {
  pending: { tone: 'review', icon: 'pending', label: 'Waiting for approval' },
  info_requested: { tone: 'atRisk', icon: 'info', label: 'More information needed' },
  approved: { tone: 'onTrack', icon: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', icon: 'close', label: 'Declined' },
  cancelled: { tone: 'neutral', icon: 'close', label: 'Cancelled' },
};

export function leaveStatusPresentation(status: LeaveRequest['status']): StatusPresentation {
  return LEAVE_STATUS[status];
}

const DELIVERABLE_STATUS: Readonly<Record<DeliverableSummary['status'], StatusPresentation>> = {
  not_submitted: { tone: 'neutral', icon: 'upload', label: 'Not submitted' },
  in_review: { tone: 'review', icon: 'review', label: 'In review' },
  changes_requested: { tone: 'atRisk', icon: 'refresh', label: 'Changes requested' },
  approved: { tone: 'onTrack', icon: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', icon: 'close', label: 'Rejected' },
  cancelled: { tone: 'neutral', icon: 'close', label: 'Cancelled' },
};

export function deliverableStatusPresentation(
  status: DeliverableSummary['status'],
): StatusPresentation {
  return DELIVERABLE_STATUS[status];
}

/** Every state a reward record can be in: an evaluation's or a milestone share's. */
export type RewardRecordStatus = RewardEvaluation['status'] | MilestoneRewardShare['status'];

const REWARD_STATUS: Readonly<Record<RewardRecordStatus, StatusPresentation>> = {
  planned: { tone: 'neutral', icon: 'flag', label: 'Planned' },
  pending_review: { tone: 'review', icon: 'pending', label: 'Waiting for review' },
  approved: { tone: 'onTrack', icon: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', icon: 'close', label: 'Not approved' },
  ineligible: { tone: 'neutral', icon: 'notMet', label: 'Not eligible' },
  withdrawn: { tone: 'neutral', icon: 'close', label: 'Withdrawn' },
};

export function isRewardRecordStatus(value: string): value is RewardRecordStatus {
  return Object.hasOwn(REWARD_STATUS, value);
}

export function rewardStatusPresentation(status: RewardRecordStatus): StatusPresentation {
  return REWARD_STATUS[status];
}

const CHALLENGE_STATUS: Readonly<Record<ChallengeEntry['status'], StatusPresentation>> = {
  open: { tone: 'review', icon: 'pending', label: 'Waiting for a reviewer' },
  upheld: { tone: 'neutral', icon: 'lock', label: 'Upheld' },
  corrected: { tone: 'onTrack', icon: 'done', label: 'Corrected' },
};

export function challengeStatusPresentation(status: ChallengeEntry['status']): StatusPresentation {
  return CHALLENGE_STATUS[status];
}
