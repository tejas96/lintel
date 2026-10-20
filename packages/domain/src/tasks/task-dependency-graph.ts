/** "taskId cannot start until dependsOnTaskId is done" (finish-to-start). */
export interface TaskDependencyEdge {
  readonly taskId: string;
  readonly dependsOnTaskId: string;
}

function prerequisitesByTask(edges: readonly TaskDependencyEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.taskId) ?? [];
    list.push(edge.dependsOnTaskId);
    map.set(edge.taskId, list);
  }
  return map;
}

function dependentsByTask(edges: readonly TaskDependencyEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.dependsOnTaskId) ?? [];
    list.push(edge.taskId);
    map.set(edge.dependsOnTaskId, list);
  }
  return map;
}

function reachable(start: string, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const stack = [...(adjacency.get(start) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined || visited.has(next)) continue;
    visited.add(next);
    stack.push(...(adjacency.get(next) ?? []));
  }
  return visited;
}

/**
 * True when adding "taskId depends on dependsOnTaskId" would close a loop,
 * including the trivial loop of a task depending on itself.
 */
export function wouldCreateDependencyCycle(
  edges: readonly TaskDependencyEdge[],
  candidate: TaskDependencyEdge,
): boolean {
  if (candidate.taskId === candidate.dependsOnTaskId) return true;
  return reachable(candidate.dependsOnTaskId, prerequisitesByTask(edges)).has(candidate.taskId);
}

/** Direct prerequisites of a task that are not finished yet. */
export function unmetPrerequisites(
  taskId: string,
  edges: readonly TaskDependencyEdge[],
  isFinished: (taskId: string) => boolean,
): string[] {
  return (prerequisitesByTask(edges).get(taskId) ?? []).filter((id) => !isFinished(id));
}

/** Every task that directly or indirectly waits for the given task. */
export function downstreamTasks(taskId: string, edges: readonly TaskDependencyEdge[]): string[] {
  return [...reachable(taskId, dependentsByTask(edges))];
}

export function directDependentCount(taskId: string, edges: readonly TaskDependencyEdge[]): number {
  return edges.filter((edge) => edge.dependsOnTaskId === taskId).length;
}

/**
 * Orders tasks so prerequisites come first (Kahn's algorithm). Returns null
 * when the graph contains a cycle.
 */
export function topologicalTaskOrder(
  taskIds: readonly string[],
  edges: readonly TaskDependencyEdge[],
): string[] | null {
  const remainingPrerequisites = new Map<string, number>(taskIds.map((id) => [id, 0]));
  for (const edge of edges) {
    remainingPrerequisites.set(edge.taskId, (remainingPrerequisites.get(edge.taskId) ?? 0) + 1);
  }
  const dependents = dependentsByTask(edges);
  const queue = taskIds.filter((id) => remainingPrerequisites.get(id) === 0);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    ordered.push(current);
    for (const dependent of dependents.get(current) ?? []) {
      const count = (remainingPrerequisites.get(dependent) ?? 0) - 1;
      remainingPrerequisites.set(dependent, count);
      if (count === 0) queue.push(dependent);
    }
  }
  return ordered.length === remainingPrerequisites.size ? ordered : null;
}
