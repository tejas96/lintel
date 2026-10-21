/** Who runs a project, as far as reassignment requests care. */
export interface ReassignmentProjectFacts {
  readonly managerUserId: string | null;
  readonly ownerUserId: string | null;
}

/**
 * Who is asked to decide: the project manager, or the project's owner when
 * the manager is the one asking. Nobody is asked to decide their own request;
 * an empty answer means nobody on the project can, and studio-wide project
 * managers are asked instead.
 */
export function reassignmentDeciders(
  facts: ReassignmentProjectFacts,
  requesterUserId: string,
): string[] {
  const first = facts.managerUserId !== requesterUserId ? facts.managerUserId : facts.ownerUserId;
  return first && first !== requesterUserId ? [first] : [];
}

/**
 * Who may decide: whoever manages the project (its manager, or anyone with
 * studio-wide project rights), and the project's owner when the manager is
 * the one asking. The domain rule still stops anyone deciding their own.
 */
export function mayDecideReassignment(
  project: ReassignmentProjectFacts & { readonly canManage: boolean },
  deciderUserId: string,
  requesterUserId: string,
): boolean {
  if (project.canManage) return true;
  return project.managerUserId === requesterUserId && project.ownerUserId === deciderUserId;
}
