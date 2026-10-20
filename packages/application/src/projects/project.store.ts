import type {
  MilestoneStatus,
  ProjectCriticality,
  ProjectRole,
  ProjectStatus,
  ProjectType,
} from '@lintel/domain';
import type { Patch } from '@lintel/shared';
import type { NewProjectPlan } from './project-plan.types';

export interface ProjectMemberInput {
  readonly userId: string;
  readonly projectRole: ProjectRole;
}

/** The editable details of a project (dates and status change through their own commands). */
export interface ProjectDetailsInput {
  readonly name: string;
  readonly clientName: string;
  readonly clientPhone: string | null;
  readonly clientEmail: string | null;
  readonly siteAddress: string | null;
  readonly description: string | null;
  readonly criticality: ProjectCriticality;
  readonly managerUserId: string;
  readonly budgetMinor: number | null;
}

export interface ProjectRecord extends ProjectDetailsInput {
  readonly id: string;
  readonly reference: string;
  readonly projectType: ProjectType;
  readonly status: ProjectStatus;
  readonly ownerUserId: string;
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  readonly version: number;
}

export interface NewProject extends ProjectDetailsInput {
  readonly reference: string;
  readonly projectType: ProjectType;
  readonly ownerUserId: string;
  readonly templateVersionId: string | null;
  readonly templateOptions: readonly string[];
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  readonly colorIndex: number;
  readonly createdByUserId: string;
}

/** A status move. Absent fields keep their stored value. */
export interface ProjectStatusChange {
  readonly status: ProjectStatus;
  readonly actualEndDate?: string | null;
  readonly archivedAt?: Date | null;
}

/** An open task, with enough detail to explain why an action is blocked. */
export interface OpenTaskFact {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly ownerUserId: string | null;
}

export interface MilestoneRecord {
  readonly id: string;
  readonly projectId: string;
  readonly stageId: string | null;
  readonly name: string;
  readonly status: MilestoneStatus;
  readonly version: number;
}

/** Write-side persistence for projects, their members, plan, milestones and stages. */
export interface ProjectStore {
  /**
   * Locks the reference series for the rest of the transaction and returns
   * every reference already issued in it (e.g. all "ARN-2026-…").
   */
  referencesInSeries(prefix: string, year: number): Promise<string[]>;
  projectCount(): Promise<number>;
  /** The subset of the given people who exist and are active. */
  activeUserIds(userIds: readonly string[]): Promise<Set<string>>;
  userNames(userIds: readonly string[]): Promise<Map<string, string>>;
  insertProject(project: NewProject): Promise<{ id: string }>;
  /** Inserts stages, milestones, tasks, checklists, deliverables and dependencies. */
  insertPlan(
    projectId: string,
    createdByUserId: string,
    plan: NewProjectPlan,
  ): Promise<Map<string, string>>;
  findById(projectId: string): Promise<ProjectRecord | null>;
  /** Applies the change only if `expectedVersion` still matches. Null on a stale version. */
  update(
    projectId: string,
    expectedVersion: number,
    changes: Patch<ProjectDetailsInput>,
  ): Promise<ProjectRecord | null>;
  changeStatus(
    projectId: string,
    expectedVersion: number,
    change: ProjectStatusChange,
  ): Promise<ProjectRecord | null>;
  members(projectId: string): Promise<ProjectMemberInput[]>;
  replaceMembers(projectId: string, members: readonly ProjectMemberInput[]): Promise<void>;
  openTasks(projectId: string): Promise<OpenTaskFact[]>;
  findMilestone(milestoneId: string): Promise<MilestoneRecord | null>;
  openTasksOfMilestone(milestoneId: string): Promise<OpenTaskFact[]>;
  completeMilestone(
    milestoneId: string,
    expectedVersion: number,
    completedByUserId: string,
    at: Date,
  ): Promise<boolean>;
  /** True when every milestone and task of the stage is closed. */
  stageIsClosed(stageId: string): Promise<boolean>;
  /** Completes the stage and activates the next pending one. Returns the activated stage name. */
  completeStageAndActivateNext(stageId: string, at: Date): Promise<{ activated: string | null }>;
}
