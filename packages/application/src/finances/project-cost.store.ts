import type { ProjectCostCategory } from '@lintel/domain';

/** One line of a project's cost ledger. Voided entries stay, marked with who and why. */
export interface ProjectCostRecord {
  readonly id: string;
  readonly projectId: string;
  readonly entryDate: string;
  readonly category: ProjectCostCategory;
  readonly amountMinor: number;
  readonly currency: string;
  readonly note: string | null;
  readonly recordedByUserId: string;
  readonly voidedAt: Date | null;
  readonly voidedByUserId: string | null;
  readonly voidReason: string | null;
  readonly version: number;
  readonly createdAt: Date;
}

export interface NewProjectCost {
  readonly projectId: string;
  readonly entryDate: string;
  readonly category: ProjectCostCategory;
  readonly amountMinor: number;
  readonly currency: string;
  readonly note: string | null;
  readonly recordedByUserId: string;
}

export interface ProjectCostVoid {
  readonly costId: string;
  readonly expectedVersion: number;
  readonly voidedByUserId: string;
  readonly reason: string;
  readonly at: Date;
}

/** Writes to the project cost ledger. Reads for screens live in the database read models. */
export interface ProjectCostStore {
  insert(cost: NewProjectCost): Promise<ProjectCostRecord>;
  /** The entry when it belongs to the project, otherwise null. */
  findInProject(projectId: string, costId: string): Promise<ProjectCostRecord | null>;
  /** Marks the entry void when its version still matches; throws StaleVersionError otherwise. */
  markVoid(change: ProjectCostVoid): Promise<ProjectCostRecord>;
}
