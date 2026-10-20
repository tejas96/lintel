export const BLOCKER_CATEGORIES = [
  'client',
  'supplier',
  'internal_dependency',
  'manager_decision',
  'information',
  'other',
] as const;
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number];

export interface ChecklistItemRecord {
  readonly id: string;
  readonly taskId: string;
  readonly label: string;
  readonly isRequired: boolean;
  readonly position: number;
  readonly completedAt: Date | null;
}

export interface BlockerRecord {
  readonly id: string;
  readonly taskId: string;
  readonly category: BlockerCategory;
  readonly reason: string;
  readonly waitingOnUserId: string | null;
  readonly raisedByUserId: string;
  readonly raisedAt: Date;
  readonly resolvedAt: Date | null;
}

export interface NewBlocker {
  readonly taskId: string;
  readonly category: BlockerCategory;
  readonly reason: string;
  readonly waitingOnUserId: string | null;
  readonly raisedByUserId: string;
}

/** Checklist items, blockers and comments that hang off a task. */
export interface TaskItemStore {
  /** Appends items after the current last position. */
  addChecklistItems(
    taskId: string,
    items: readonly { label: string; isRequired: boolean }[],
  ): Promise<ChecklistItemRecord[]>;
  findChecklistItem(itemId: string): Promise<ChecklistItemRecord | null>;
  setChecklistItemCompletion(
    itemId: string,
    completion: { readonly at: Date; readonly byUserId: string } | null,
  ): Promise<void>;
  removeChecklistItem(itemId: string): Promise<void>;
  createBlocker(blocker: NewBlocker): Promise<BlockerRecord>;
  /** Locks the blocker row until the transaction ends. */
  findBlockerForUpdate(blockerId: string): Promise<BlockerRecord | null>;
  resolveBlocker(
    blockerId: string,
    resolution: { readonly at: Date; readonly byUserId: string; readonly note: string },
  ): Promise<void>;
  openBlockerCount(taskId: string): Promise<number>;
  addComment(taskId: string, authorUserId: string, body: string): Promise<{ id: string }>;
}
