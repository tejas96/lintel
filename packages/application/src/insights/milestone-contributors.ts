/** A task of a project with a completed milestone, as the credit rule needs it. */
export interface MilestoneWorkTask {
  readonly id: string;
  readonly milestoneId: string | null;
  readonly parentTaskId: string | null;
  readonly ownerUserId: string | null;
  readonly finished: boolean;
  /** The tasks this one waits for. */
  readonly dependsOnTaskIds: readonly string[];
  /** People who submitted a version of one of its deliverables. */
  readonly submitterUserIds: readonly string[];
}

/**
 * The work behind a milestone: its own tasks, their subtasks, and the work
 * they wait for that belongs to no milestone of its own ("Measure the site"
 * feeds "Review the site survey", which closes "Brief signed off"). Work
 * linked to another milestone is credited there, not here.
 */
export function milestoneWorkTaskIds(
  milestoneId: string,
  tasks: readonly MilestoneWorkTask[],
): Set<string> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const included = new Set<string>();
  const queue = tasks.filter((task) => task.milestoneId === milestoneId).map((task) => task.id);
  const unlinked = (id: string) => byId.get(id)?.milestoneId === null;
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined || included.has(id)) continue;
    const task = byId.get(id);
    if (!task) continue;
    included.add(id);
    queue.push(...task.dependsOnTaskIds.filter(unlinked));
    for (const child of tasks) {
      if (child.parentTaskId === id && child.milestoneId === null) queue.push(child.id);
    }
  }
  return included;
}

/**
 * Who did the work of a milestone: the owners of its finished tasks (see
 * `milestoneWorkTaskIds`) and the people who submitted their deliverables.
 */
export function milestoneContributors(
  milestoneId: string,
  tasks: readonly MilestoneWorkTask[],
): string[] {
  const work = milestoneWorkTaskIds(milestoneId, tasks);
  const people = new Set<string>();
  for (const task of tasks) {
    if (!work.has(task.id)) continue;
    if (task.finished && task.ownerUserId) people.add(task.ownerUserId);
    for (const userId of task.submitterUserIds) people.add(userId);
  }
  return [...people];
}
