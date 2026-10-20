import type { ProjectRole } from '@lintel/domain';

export interface ProjectAccessFacts {
  readonly projectId: string;
  readonly exists: boolean;
  readonly projectRole: ProjectRole | null;
  readonly managerUserId: string | null;
  readonly ownerUserId: string | null;
}

/** Looks up how a person relates to projects. Used by every project-scoped use case. */
export interface ProjectAccessStore {
  accessFacts(projectId: string, userId: string): Promise<ProjectAccessFacts>;
  /** Project IDs the person is a member of (any project role). */
  memberProjectIds(userId: string): Promise<string[]>;
  /** Resolves the project of a task, deliverable or milestone. Null when it does not exist. */
  projectIdOfTask(taskId: string): Promise<string | null>;
  projectIdOfDeliverable(deliverableId: string): Promise<string | null>;
  projectIdOfMilestone(milestoneId: string): Promise<string | null>;
}
